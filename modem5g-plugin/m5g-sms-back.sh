#!/bin/sh
# 延迟自动恢复原制式（收信/发短信后端兜底，不依赖浏览器定时器）
# usage: m5g-sms-back.sh <seconds>
# 恢复的是切 4G 前记录的原制式（/tmp/m5g-mode-before），不再写死 3g|4g|5g
LOCK=/tmp/m5g-smsback.lock
mkdir "$LOCK" 2>/dev/null || exit 0     # 单例：已有定时器在跑则不重复
rm -f /tmp/m5g-smsback.cancel           # 清残留取消标记（防吞掉本定时器）
trap 'rm -rf "$LOCK" /tmp/m5g-smsback.cancel' EXIT INT TERM
SECS="${1:-120}"
[ "$SECS" = "0" ] && exit 0
sleep "$SECS"
[ -f /tmp/m5g-smsback.cancel ] && exit 0
MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
if [ -n "$MOD" ]; then
	ALLOWED=$(sed -n '1p' /tmp/m5g-mode-before 2>/dev/null)
	PREF=$(sed -n '2p' /tmp/m5g-mode-before 2>/dev/null)
	[ -n "$ALLOWED" ] || ALLOWED="3g|4g|5g"
	[ -n "$PREF" ] || PREF="5g"
	mmcli -m "$MOD" --set-allowed-modes="$ALLOWED" --set-preferred-mode="$PREF" >/dev/null 2>&1
fi
rm -f /tmp/m5g-mode-before
