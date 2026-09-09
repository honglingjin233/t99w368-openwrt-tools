#!/bin/sh
# 5G 模块数据面看门狗 v2：真实连通性验证 + 4G 收信模式跳过 + 重拨日志
# 防重复启动（PID 文件）
[ -f /tmp/m5g-watchdog.pid ] && kill -0 "$(cat /tmp/m5g-watchdog.pid)" 2>/dev/null && exit 0
echo $$ > /tmp/m5g-watchdog.pid

log() { echo "$(date '+%m-%d %H:%M:%S') $1" >> /tmp/m5g-watchdog.log; }

while true; do
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	if [ -n "$MOD" ]; then
		# 4G-only（收信模式）跳过重拨，避免打断收信窗口或反复重拨
		ALLOWED=$(mmcli -m "$MOD" 2>/dev/null | grep 'allowed:' | head -1)
		if echo "$ALLOWED" | grep -q 'allowed: 4g;'; then
			sleep 60
			continue
		fi
		ST=$(mmcli -m "$MOD" 2>/dev/null | grep 'state:' | grep -oE 'connected|registered' | head -1)
		IP=$(ip addr show wwan0 2>/dev/null | grep -oE 'inet [0-9.]+' | head -1)
		if [ -n "$ST" ] && [ -z "$IP" ]; then
			# 模块在网但无 IP：校准 device + 拨号
			log "检测到无 IP，自动重拨"
			uci set network.wwan.device="$MOD"
			uci commit network
			ifup wwan
		elif [ -n "$IP" ]; then
			# 有 IP：验证真实连通（ping 默认网关，2 次；防残留缓存假连接）
			GW=$(ip route 2>/dev/null | grep wwan0 | grep default | awk '{print $3}')
			if [ -n "$GW" ] && ! ping -c 2 -W 2 "$GW" >/dev/null 2>&1; then
				log "检测到假连接（网关不通），自动重拨"
				uci set network.wwan.device="$MOD"
				uci commit network
				ifdown wwan 2>/dev/null
				sleep 2
				ifup wwan
			fi
		fi
	fi
	sleep 60
done
