#!/bin/sh
# m5g-signal-guard.sh —— 智能选网守护（信号阈值切换）
# 逻辑：5G RSRP < 阈值 连续 3 次 → 切 4G（MM API）；冷却结束后尝试恢复 5G
# 互斥：短信收信定时器(m5g-smsback.lock)存在时让路；看门狗在 4g 制式下自动跳过重拨
# 配置：uci modem5g.guard.{enabled,threshold,cooldown}
PIDF=/tmp/m5g-signal-guard.pid
if [ -f "$PIDF" ]; then
	OPID=$(cat "$PIDF" 2>/dev/null)
	if [ -n "$OPID" ] && kill -0 "$OPID" 2>/dev/null && grep -q m5g-signal-guard /proc/$OPID/cmdline 2>/dev/null; then
		exit 0
	fi
	rm -f "$PIDF"
fi
echo $$ > "$PIDF"
trap 'rm -f "$PIDF"' EXIT INT TERM

log() {
	echo "$(date '+%m-%d %H:%M:%S') $1" >> /tmp/m5g-signal-guard.log
	tail -n 100 /tmp/m5g-signal-guard.log > /tmp/m5g-signal-guard.tmp 2>/dev/null && mv /tmp/m5g-signal-guard.tmp /tmp/m5g-signal-guard.log
}

THRESHOLD=$(uci -q get modem5g.guard.threshold 2>/dev/null); [ -n "$THRESHOLD" ] || THRESHOLD=-110
COOLDOWN=$(uci -q get modem5g.guard.cooldown 2>/dev/null); [ -n "$COOLDOWN" ] || COOLDOWN=600
LOW=0
WAIT=0

while true; do
	[ "$(uci -q get modem5g.guard.enabled 2>/dev/null)" = "1" ] || exit 0
	# 短信收信/发信定时器运行中：让路
	if [ -d /tmp/m5g-smsback.lock ]; then
		sleep 30; continue
	fi
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	if [ -z "$MOD" ]; then
		sleep 30; continue
	fi
	CM=$(mmcli -m "$MOD" --output-json 2>/dev/null | grep -oE '"current-modes":"[^"]*"' | head -1 | cut -d'"' -f4)
	case "$CM" in
		"allowed: 4g;"*)
			# 已在 4G：冷却结束尝试恢复 5G（避免来回抖动）
			if [ "$WAIT" -ge "$COOLDOWN" ]; then
				mmcli -m "$MOD" --set-allowed-modes="3g|4g|5g" --set-preferred-mode="5g" >/dev/null 2>&1
				LOW=0; WAIT=0
				log "冷却结束，尝试恢复 5G"
			else
				WAIT=$((WAIT+30))
			fi
			sleep 30; continue
			;;
	esac
	# 读 5G RSRP（mmcli signal；先按 5g 块解析，失败回退全局第一个 rsrp）
	RSRP=$(mmcli -m "$MOD" --signal-get --output-json 2>/dev/null | grep -oE '"5g":\{[^}]*\}' | grep -oE '"rsrp":"[^"]*"' | head -1 | cut -d'"' -f4)
	if [ -z "$RSRP" ] || [ "$RSRP" = "--" ]; then
		RSRP=$(mmcli -m "$MOD" --signal-get --output-json 2>/dev/null | grep -oE '"rsrp":"[^"]*"' | head -1 | cut -d'"' -f4)
	fi
	if [ -n "$RSRP" ] && [ "$RSRP" != "--" ] && [ "$RSRP" -lt "$THRESHOLD" ] 2>/dev/null; then
		LOW=$((LOW+1))
		if [ "$LOW" -ge 3 ]; then
			mmcli -m "$MOD" --set-allowed-modes="4g" >/dev/null 2>&1
			log "5G 信号弱(RSRP ${RSRP}dBm)，自动切 4G（${COOLDOWN}s 后尝试恢复）"
			LOW=0; WAIT=0
		fi
	else
		LOW=0
	fi
	sleep 30
done
