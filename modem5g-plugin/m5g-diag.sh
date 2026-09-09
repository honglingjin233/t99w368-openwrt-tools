#!/bin/sh
# T99W368 一键诊断报告生成器
# 收集 AT 全集 + MM 状态 + 数据面 + 连通性 → /tmp/m5g-diag.txt
OUT=/tmp/m5g-diag.txt
MOD=$(mmcli -L 2>/dev/null | grep -oE 'Modem/[0-9]+' | grep -oE '[0-9]+' | head -1)

{
echo "===== T99W368 诊断报告  $(date '+%Y-%m-%d %H:%M:%S') ====="
echo
echo "--- 1. 模块信息 (ATI) ---"
sh /usr/bin/m5g-at.sh "ATI" 2>/dev/null
echo
echo "--- 2. 固件/IMEI/IMSI ---"
sh /usr/bin/m5g-at.sh "AT+CGMR" 2>/dev/null
sh /usr/bin/m5g-at.sh "AT+CGSN" 2>/dev/null
sh /usr/bin/m5g-at.sh "AT+CIMI" 2>/dev/null
echo
echo "--- 3. 注册状态 ---"
sh /usr/bin/m5g-at.sh "AT+C5GREG?" 2>/dev/null
sh /usr/bin/m5g-at.sh "AT+CEREG?" 2>/dev/null
echo
echo "--- 4. 运营商/制式 ---"
sh /usr/bin/m5g-at.sh "AT+COPS?" 2>/dev/null
echo
echo "--- 5. 射频/温度 ---"
sh /usr/bin/m5g-at.sh "AT+CFUN?" 2>/dev/null
sh /usr/bin/m5g-at.sh "AT+temp?" 2>/dev/null
echo
echo "--- 6. MM 状态 ---"
if [ -n "$MOD" ]; then
	mmcli -m "$MOD" 2>/dev/null | grep -E "state:|power state|access tech|operator|signal quality|packet service" | head -8
else
	echo "模块未识别"
fi
echo
echo "--- 7. 信号（双载波）---"
[ -n "$MOD" ] && mmcli -m "$MOD" --signal-get 2>/dev/null | grep -E "LTE|5G|rsrp|s/n" | head -8
echo
echo "--- 8. 数据面 ---"
echo "wwan0 接口: $(ip addr show wwan0 2>/dev/null | grep 'inet ' | head -1)"
echo "AT 真实 PDP:"
sh /usr/bin/m5g-at.sh "AT+CGCONTRDP=5" 2>/dev/null
echo "接口计数: $(cat /proc/net/dev | grep wwan0)"
echo
echo "--- 9. 制式/频段 ---"
[ -n "$MOD" ] && mmcli -m "$MOD" 2>/dev/null | grep -E "allowed:|preferred|current bands" | head -3
echo
echo "--- 10. 连通性 ---"
GW=$(ip route 2>/dev/null | grep wwan0 | grep default | awk '{print $3}')
echo "网关: ${GW:-无}"
[ -n "$GW" ] && echo "ping 网关: $(ping -c 2 -W 2 "$GW" 2>&1 | tail -1)"
echo "ping 223.5.5.5: $(ping -c 2 -W 2 223.5.5.5 2>&1 | tail -1)"
echo
echo "--- 11. 看门狗 ---"
if kill -0 "$(cat /tmp/m5g-watchdog.pid 2>/dev/null)" 2>/dev/null; then echo "运行中 (pid $(cat /tmp/m5g-watchdog.pid))"; else echo "未运行"; fi
tail -3 /tmp/m5g-watchdog.log 2>/dev/null
echo
echo "--- 12. 系统 ---"
uptime
} > "$OUT" 2>&1
echo "诊断完成"
