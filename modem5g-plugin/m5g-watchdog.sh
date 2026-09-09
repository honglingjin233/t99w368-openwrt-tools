#!/bin/sh
# T99W368 数据面看门狗 v4：连续失败计数 + DNS 二次确认 + hold 互斥 + sysfs 绑定 + 日志轮转 + MM 兜底重启
# 互斥：插件 doRedial/reset/scan 进行时写 /tmp/m5g-{redial,reset,scan}.hold（内容=epoch 秒），
#       本看门狗见 <120s 的新 hold 让路；自己重拨前也写 redial.hold 防插件反向并发。
PIDF=/tmp/m5g-watchdog.pid
if [ -f "$PIDF" ]; then
	OPID=$(cat "$PIDF" 2>/dev/null)
	if [ -n "$OPID" ] && kill -0 "$OPID" 2>/dev/null \
	   && grep -q m5g-watchdog /proc/$OPID/cmdline 2>/dev/null; then
		exit 0          # 已有实例在跑
	fi
	rm -f "$PIDF"       # 残留（被杀-9/OOM）且 cmdline 对不上 → 清理重起
fi
echo $$ > "$PIDF"

log() {
	echo "$(date '+%m-%d %H:%M:%S') $1" >> /tmp/m5g-watchdog.log
	tail -n 300 /tmp/m5g-watchdog.log > /tmp/m5g-watchdog.tmp && mv /tmp/m5g-watchdog.tmp /tmp/m5g-watchdog.log
}

# 趋势采样（CSV: ts,rsrp,snr,tsens,rx+tx；约每 60s 1 点；失败跳过不阻塞）
sample_trend() {
	local MOD="$1" TS=$(date +%s) RSRP="" SNR="" TSENS="" RT=""
	mmcli -m "$MOD" --signal-setup=30 >/dev/null 2>&1        # 30s 上报（原 3s 风暴过大）
	sleep 2
	RSRP=$(mmcli -m "$MOD" --signal-get --output-json 2>/dev/null | grep -oE '"5g":\{[^}]*\}' | grep -oE '"rsrp":"[^"]*"' | head -1 | cut -d'"' -f4)
	SNR=$(mmcli -m "$MOD" --signal-get --output-json 2>/dev/null | grep -oE '"5g":\{[^}]*\}' | grep -oE '"snr":"[^"]*"' | head -1 | cut -d'"' -f4)
	TSENS=$(sh /usr/bin/m5g-at.sh 'AT+temp?' cache 2>/dev/null | grep -oE 'TSENS: *[0-9]+' | grep -oE '[0-9]+')
	RT=$(awk '/wwan0/{print $2+$10}' /proc/net/dev 2>/dev/null)
	[ -n "$RSRP" ] || RSRP="--"; [ -n "$SNR" ] || SNR="--"
	[ -n "$TSENS" ] || TSENS="--"; [ -n "$RT" ] || RT="0"
	echo "$TS,$RSRP,$SNR,$TSENS,$RT" >> /tmp/m5g-trend.csv
	local LINES=$(wc -l < /tmp/m5g-trend.csv 2>/dev/null)
	[ "$LINES" -gt 1440 ] && tail -n 1440 /tmp/m5g-trend.csv > /tmp/m5g-trend.tmp && mv /tmp/m5g-trend.tmp /tmp/m5g-trend.csv
}

# hold 是否已过期（内容=epoch 秒；本系统无 stat，改用 date 计算）
hold_stale() {
	[ -f "$1" ] || return 1
	local AGE=$(( $(date +%s) - $(cat "$1" 2>/dev/null || echo 0) ))
	[ "$AGE" -gt 120 ]
}

[ -f /tmp/m5g-trend.csv ] || echo "#ts,rsrp,snr,tsens,rx_tx" > /tmp/m5g-trend.csv
FAIL=0        # 连续失败计数（防 ICMP 被禁时每 60s 重拨风暴）
NOMOD=0       # 连续无 modem 计数（MM 挂了兜底重启）

while true; do
	# 清理过期 hold（进程被杀残留）
	for f in /tmp/m5g-redial.hold /tmp/m5g-reset.hold /tmp/m5g-scan.hold; do
		[ -e "$f" ] && hold_stale "$f" && rm -f "$f"
	done
	if ls /tmp/m5g-redial.hold /tmp/m5g-reset.hold /tmp/m5g-scan.hold >/dev/null 2>&1; then
		sleep 30; continue        # 有操作进行中：让路
	fi
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	if [ -z "$MOD" ]; then
		NOMOD=$((NOMOD+1)); FAIL=0
		if [ "$NOMOD" -ge 10 ]; then
			log "连续无 modem(MM 可能挂)，重启 ModemManager"
			/etc/init.d/modemmanager restart
			NOMOD=0
		fi
		sleep 30; continue
	fi
	NOMOD=0
	sample_trend "$MOD"
	# 制式跳过：仅当前 allowed 恰为 4g（收信模式）时不重拨；
	# 不能 grep 'allowed: 4g;' —— supported 组合列表里也有 "allowed: 4g; preferred: none" 会误命中
	CM=$(mmcli -m "$MOD" --output-json 2>/dev/null | grep -oE '"current-modes":"[^"]*"' | head -1 | cut -d'"' -f4)
	case "$CM" in
		"allowed: 4g;"*) sleep 30; continue ;;
	esac
	DEV=$(sh /usr/bin/m5g-dev.sh "$MOD")
	ST=$(mmcli -m "$MOD" 2>/dev/null | grep 'state:' | grep -oE 'connected|registered|disabled|enabled' | head -1)
	if [ "$ST" = "disabled" ]; then
		log "检测到模块 disabled，自动启用"
		mmcli -m "$MOD" -e >/dev/null 2>&1
		sleep 20; continue
	fi
	IP=$(ip addr show wwan0 2>/dev/null | grep -oE 'inet [0-9.]+' | head -1)
	NEED=0; REASON=""
	if [ -n "$ST" ] && [ -z "$IP" ]; then NEED=1; REASON="无IP"; fi
	if [ -n "$IP" ]; then
		GW=$(ip route 2>/dev/null | awk '/default/ && /wwan0/ {print $3; exit}')
		if [ -n "$GW" ] && ! ping -c 2 -W 2 "$GW" >/dev/null 2>&1; then
			# 二次确认：换公网 DNS 探测（防运营商禁 ICMP 误判导致重拨风暴）
			if ! ping -c 1 -W 2 -I wwan0 223.5.5.5 >/dev/null 2>&1 \
			   && ! ping -c 1 -W 2 -I wwan0 119.29.29.29 >/dev/null 2>&1; then
				NEED=1; REASON="网关与DNS均不通(假连接?)"
			fi
		fi
	fi
	if [ "$NEED" = "1" ]; then
		FAIL=$((FAIL+1))
		if [ "$FAIL" -ge 3 ]; then
			date +%s > /tmp/m5g-redial.hold
			log "自动重拨(连续${FAIL}次失败,原因:${REASON})"
			if [ -n "$DEV" ] && [ "$(uci -q get network.wwan.device 2>/dev/null)" != "$DEV" ]; then
				uci set network.wwan.device="$DEV"; uci commit network   # 仅变化时写 flash
			fi
			ifdown wwan 2>/dev/null; sleep 2; ifup wwan                  # 关键：先下再上
			rm -f /tmp/m5g-redial.hold
			FAIL=0
		fi
	else
		FAIL=0
	fi
	sleep 60
done
