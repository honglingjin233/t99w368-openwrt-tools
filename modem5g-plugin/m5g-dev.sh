#!/bin/sh
# m5g-dev.sh <mmcli索引> → 输出当前 modem 的 sysfs 物理路径（找不到输出空）
# sysfs 路径在 MM 重启/热插拔后稳定；数值索引会漂移（重启归零/热插拔递增），不可写入 uci
[ -n "$1" ] || exit 1
mmcli -m "$1" 2>/dev/null | grep 'device:' | grep -oE '/sys/[^ ]+' | head -1
