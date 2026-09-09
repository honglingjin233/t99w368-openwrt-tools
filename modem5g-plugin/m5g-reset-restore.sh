#!/bin/sh
# modem5g 模块复位后自动恢复：等模块重枚举 -> 动态校准 device -> 重拨
sleep 40
MOD=""
for i in 1 2 3 4 5 6; do
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	[ -n "$MOD" ] && break
	sleep 10
done
if [ -n "$MOD" ]; then
	uci set network.wwan.device="$MOD"
	uci commit network
	ifup wwan
fi
