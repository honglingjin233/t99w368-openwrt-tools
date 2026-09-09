#!/bin/sh
# AT+debug? 小区/CA 信息实测
ADB=/usr/bin/adb
$ADB shell "run_at() { CMD=\"\$1\"; W=\"\$2\"; timeout 12 cat /dev/at_mdm0 > /tmp/at_o 2>&1 & CP=\$!; sleep 0.5; printf \"%s\r\" \"\$CMD\" > /dev/at_mdm0; sleep \$W; kill \$CP 2>/dev/null; echo \"### \$CMD\"; tr -d \"\r\" < /tmp/at_o | grep -v \"^\$\" | head -30; }; 
run_at \"AT+debug?\" 8;
run_at \"AT+ICCID\" 6;
" 2>&1 | grep -vE "^Warning"
