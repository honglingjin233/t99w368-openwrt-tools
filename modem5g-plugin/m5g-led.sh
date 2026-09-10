#!/bin/sh
# m5g-led.sh —— LED 状态联动守护
# 模块 connected/registered → 指定 LED 亮；否则灭。先写 trigger=none 防被其他驱动抢占。
# 配置：uci modem5g.led.{enabled,name}
PIDF=/tmp/m5g-led.pid
if [ -f "$PIDF" ]; then
	OPID=$(cat "$PIDF" 2>/dev/null)
	if [ -n "$OPID" ] && kill -0 "$OPID" 2>/dev/null && grep -q m5g-led /proc/$OPID/cmdline 2>/dev/null; then
		exit 0
	fi
	rm -f "$PIDF"
fi
echo $$ > "$PIDF"
trap 'rm -f "$PIDF"' EXIT INT TERM

LED=""
while true; do
	[ "$(uci -q get modem5g.led.enabled 2>/dev/null)" = "1" ] || exit 0
	NEWLED=$(uci -q get modem5g.led.name 2>/dev/null)
	[ -n "$NEWLED" ] || exit 0
	if [ "$NEWLED" != "$LED" ]; then
		LED="$NEWLED"
		echo none > "/sys/class/leds/$LED/trigger" 2>/dev/null
	fi
	MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
	ON=0
	if [ -n "$MOD" ]; then
		ST=$(mmcli -m "$MOD" 2>/dev/null | grep 'state:' | grep -oE 'connected|registered' | head -1)
		[ -n "$ST" ] && ON=1
	fi
	echo "$ON" > "/sys/class/leds/$LED/brightness" 2>/dev/null
	sleep 15
done
