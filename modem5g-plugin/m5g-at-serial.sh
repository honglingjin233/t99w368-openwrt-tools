#!/bin/sh
# m5g-at-serial.sh — 通用 USB 串口 AT 查询通道（FM350-GL / RM500Q-CN 等非 ADB 模组）
# usage: m5g-at-serial.sh <端口> "<AT指令>" [cache]
# 特性：输入白名单（含双引号，支持 QNWPREFCFG="nr5g_band" 类）、串行锁、绝对超时、可选 60s 缓存
# 与 m5g-at.sh（T99W368 ADB 通道）并列，由后端 atQuery() 按模组分发
PORT="$1"; CMD="$2"; OPT="$3"
[ -n "$PORT" ] && [ -n "$CMD" ] || { echo "用法: m5g-at-serial.sh <端口> \"<AT指令>\" [cache]"; exit 1; }

# 白名单：允许引号/逗号/等号/斜杠（QNWPREFCFG="nr5g_band"、GTSENRDTEMP=1、QENG="servingcell"）
echo "$CMD" | grep -qE '^[A-Za-z0-9+?=@_%*#!.:/,"-]{1,64}$' || { echo "非法指令"; exit 1; }

# 缓存：60s 内直接回
CACHE="/tmp/m5g-at.$(echo "$CMD" | md5sum | cut -c1-8)"
if [ "$OPT" = "cache" ] && [ -f "$CACHE" ]; then
	AGE=$(( $(date +%s) - $(sed -n '1p' "$CACHE" 2>/dev/null) ))
	[ "$AGE" -lt 60 ] && { sed -n '2,$p' "$CACHE"; exit 0; }
fi

# 串行锁（与 m5g-at.sh 同款 mkdir 锁，独立锁名避免与 ADB 通道互踩）
LOCK=/tmp/m5g-at-ser.lock
if ! mkdir "$LOCK" 2>/dev/null; then
	LPID=$(cat "$LOCK/pid" 2>/dev/null)
	if [ -n "$LPID" ] && ! kill -0 "$LPID" 2>/dev/null; then
		rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || { echo "AT 通道忙"; exit 1; }
	else
		echo "AT 通道忙（有查询进行中）"; exit 1
	fi
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM

# 端口存在性
[ -e "$PORT" ] || { echo "端口不存在: $PORT"; exit 1; }

# 配置串口并打开 fd
stty -F "$PORT" 115200 raw -echo -echoe -echok -ixon 2>/dev/null || { echo "串口配置失败: $PORT"; exit 1; }
exec 3<>"$PORT"

OUT=""
for TRY in 1 2; do
	# 清理残留输入
	dd bs=256 count=1 <&3 2>/dev/null >/dev/null
	printf '%s\r\n' "$CMD" >&3
	ACC=""
	DEADLINE=$(( $(date +%s) + 6 ))
	while [ $(date +%s) -lt "$DEADLINE" ]; do
		CHUNK=$(dd bs=1 count=256 <&3 2>/dev/null)
		ACC="$ACC$CHUNK"
		echo "$ACC" | grep -qE '(^|\r|\n)(OK|ERROR)\r?$' && break
		sleep 1
	done
	OUT=$(echo "$ACC" | tr -d '\r' | grep -v '^$')
	[ -n "$OUT" ] && break
done
exec 3>&-

if [ "$OPT" = "cache" ] && [ -n "$OUT" ]; then
	{ date +%s; echo "$OUT"; } > "$CACHE"
fi
echo "$OUT"
