#!/bin/sh
# 延迟自动切回 5G（modem5g 收信模式兜底，不依赖浏览器定时器）
# usage: m5g-sms-back.sh <seconds> <modem-index>
sleep "${1:-120}"
MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)
[ -n "$MOD" ] && mmcli -m "$MOD" --set-allowed-modes="3g|4g|5g" --set-preferred-mode="5g" >/dev/null 2>&1
