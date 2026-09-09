#!/bin/sh
# T99W368 AT 查询（ADB 通道 /dev/at_mdm0，连续发送模式，工程板可靠）
# usage: m5g-at.sh "AT+xxx"  （仅预设只读查询指令）
CMD="$1"
[ -z "$CMD" ] && exit 1
OUT=""
for TRY in 1 2 3; do
	OUT=$(/usr/bin/adb shell "OUT=/data/local/tmp/at_o.txt; rm -f \$OUT; cat /dev/at_mdm0 > \$OUT 2>&1 & CP=\$!; sleep 1; printf '%s\r' \"$CMD\" > /dev/at_mdm0; sleep 5; kill \$CP 2>/dev/null; tr -d '\r' < \$OUT | grep -v '^$'" 2>/dev/null | grep -vE "^Warning")
	[ -n "$OUT" ] && break
	sleep 1
done
echo "$OUT"
