#!/bin/sh
# m5g-traffic.sh —— 流量快照守护（月度统计数据源）
# 每分钟记录 wwan0 接口计数快照；接口计数重启归零时基准自动重设（重启当日从重启起算）
# 输出 /tmp/m5g-traffic.log：每行 "日期 基准RX 基准TX 当前RX 当前TX"（当日行覆盖）
PIDF=/tmp/m5g-traffic.pid
if [ -f "$PIDF" ]; then
	OPID=$(cat "$PIDF" 2>/dev/null)
	if [ -n "$OPID" ] && kill -0 "$OPID" 2>/dev/null && grep -q m5g-traffic /proc/$OPID/cmdline 2>/dev/null; then
		exit 0
	fi
	rm -f "$PIDF"
fi
echo $$ > "$PIDF"
trap 'rm -f "$PIDF"' EXIT INT TERM

LOGF=/tmp/m5g-traffic.log
[ -f "$LOGF" ] || echo "#DATE BASE_RX BASE_TX CUR_RX CUR_TX" > "$LOGF"

while true; do
	DAY=$(date +%F)
	RX=$(awk '/wwan0/{print $2}' /proc/net/dev 2>/dev/null)
	TX=$(awk '/wwan0/{print $10}' /proc/net/dev 2>/dev/null)
	[ -n "$RX" ] || RX=0
	[ -n "$TX" ] || TX=0
	if grep -q "^$DAY " "$LOGF" 2>/dev/null; then
		BASE_RX=$(awk -v d="$DAY" '$1==d{print $2}' "$LOGF")
		BASE_TX=$(awk -v d="$DAY" '$1==d{print $3}' "$LOGF")
		# 计数器重置（重启）：更新基准为当前值
		if [ -z "$BASE_RX" ] || [ "$RX" -lt "$BASE_RX" ] 2>/dev/null; then BASE_RX=$RX; fi
		if [ -z "$BASE_TX" ] || [ "$TX" -lt "$BASE_TX" ] 2>/dev/null; then BASE_TX=$TX; fi
		sed -i "s/^$DAY .*/$DAY $BASE_RX $BASE_TX $RX $TX/" "$LOGF" 2>/dev/null
	else
		echo "$DAY $RX $TX $RX $TX" >> "$LOGF"
	fi
	# 只保留最近 62 天
	tail -n 62 "$LOGF" > "$LOGF.tmp" 2>/dev/null && mv "$LOGF.tmp" "$LOGF"
	sleep 60
done
