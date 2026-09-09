#!/bin/sh
# T99W368 AT 查询 v2（ADB 通道 /dev/at_mdm0，连续发送模式，工程板可靠）
# 改动(v1→v2)：绝对超时 + 串行锁 + 输入白名单 + 残留 cat 预清理 + adb root 幂等 + 可选 60s 缓存
# usage: m5g-at.sh "<AT指令>" [cache]   （cache 给 temp/看门狗用，AT 通道慢避免反复阻塞 rpcd）
CMD="$1"
[ -n "$CMD" ] || exit 1
echo "$CMD" | grep -qE '^[A-Za-z0-9+?=@_%*#!.:/,-]{1,40}$' || { echo "非法指令"; exit 1; }

# 缓存：60s 内直接回（内容 = 第1行 epoch 时间戳 + 其余为输出）
CACHE="/tmp/m5g-at.$(echo "$CMD" | md5sum | cut -c1-8)"
if [ "$2" = "cache" ] && [ -f "$CACHE" ]; then
	AGE=$(( $(date +%s) - $(sed -n '1p' "$CACHE" 2>/dev/null) ))
	[ "$AGE" -lt 60 ] && { sed -n '2,$p' "$CACHE"; exit 0; }
fi

# 串行锁（busybox flock 不保证启用，用 mkdir）：AT 通道同一时刻只允许一个查询
# 锁内记持有者 PID：进程被 kill -9 后残留锁可由后来者检测清理，避免 AT 永久不可用
LOCK=/tmp/m5g-at.lock
if ! mkdir "$LOCK" 2>/dev/null; then
	LPID=$(cat "$LOCK/pid" 2>/dev/null)
	if [ -n "$LPID" ] && ! kill -0 "$LPID" 2>/dev/null; then
		rm -rf "$LOCK"
		mkdir "$LOCK" 2>/dev/null || { echo "AT 通道忙（有查询进行中）"; exit 1; }
	else
		echo "AT 通道忙（有查询进行中）"; exit 1
	fi
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM

# 幂等补 root：模块复位后 adbd 掉权限为 shell 用户，AT 会静默失败；等待 adbd 重启就绪
/usr/bin/adb root >/dev/null 2>&1
for _i in 1 2 3 4 5 6 7 8 9 10; do
	/usr/bin/adb shell 'echo ok' >/dev/null 2>&1 && break
	sleep 1
done

OUT=""
for TRY in 1 2; do
	OUT=$(timeout 12 /usr/bin/adb shell "pkill -f '^cat /dev/at_mdm0' 2>/dev/null; OUT=/data/local/tmp/at_o.txt; rm -f \$OUT; cat /dev/at_mdm0 > \$OUT 2>&1 & CP=\$!; sleep 1; printf '%s\r' \"$CMD\" > /dev/at_mdm0; sleep 4; kill \$CP 2>/dev/null; tr -d '\r' < \$OUT | grep -v '^$'" 2>/dev/null | grep -vE '^Warning')
	[ -n "$OUT" ] && break
	sleep 1
done

if [ "$2" = "cache" ] && [ -n "$OUT" ]; then
	{ date +%s; echo "$OUT"; } > "$CACHE"
fi
echo "$OUT"
