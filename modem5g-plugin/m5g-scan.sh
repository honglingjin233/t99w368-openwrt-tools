#!/bin/sh
# modem5g 后台网络扫描：PID 写文件供状态轮询，完成自动清理
echo $$ > /tmp/m5g-scan.pid
timeout 90 mmcli -m "$1" --3gpp-scan > /tmp/m5g-scan.out 2>&1
rm -f /tmp/m5g-scan.pid
