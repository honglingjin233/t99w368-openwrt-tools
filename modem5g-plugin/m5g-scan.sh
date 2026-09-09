#!/bin/sh
# modem5g 后台网络扫描：PID 供状态轮询 + hold 防看门狗抢拨 + 完成自动清理
# mmcli 内层 --timeout=90：官方要求扫描必须显式给超时，否则 D-Bus 默认约 25s 自爆
echo $$ > /tmp/m5g-scan.pid
date +%s > /tmp/m5g-scan.hold            # 看门狗见 hold 让路（扫描期间 modem 会离网）
trap 'rm -f /tmp/m5g-scan.pid /tmp/m5g-scan.hold' EXIT INT TERM
: > /tmp/m5g-scan.out
timeout 100 mmcli -m "$1" --3gpp-scan --timeout=90 > /tmp/m5g-scan.out 2>&1
rm -f /tmp/m5g-scan.pid /tmp/m5g-scan.hold
