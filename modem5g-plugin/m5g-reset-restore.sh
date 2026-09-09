#!/bin/sh
# modem5g 模块复位后自动恢复：等重枚举 -> sysfs 路径校准 -> 重拨（hold 防看门狗抢拨）
date +%s > /tmp/m5g-reset.hold
trap 'rm -f /tmp/m5g-reset.hold' EXIT INT TERM
sleep 40
MOD=""
for i in 1 2 3 4 5 6; do
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	[ -n "$MOD" ] && break
	sleep 10
done
if [ -n "$MOD" ]; then
	DEV=$(sh /usr/bin/m5g-dev.sh "$MOD")
	if [ -n "$DEV" ] && [ "$(uci -q get network.wwan.device 2>/dev/null)" != "$DEV" ]; then
		uci set network.wwan.device="$DEV"
		uci commit network
	fi
	ifdown wwan 2>/dev/null; sleep 2; ifup wwan
fi
