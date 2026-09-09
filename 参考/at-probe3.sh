#!/bin/sh
# T99W368 Foxconn 指令实测·加长等待版（含 AT+debug? 小区/CA）
ADB=/usr/bin/adb
$ADB shell "run_at() { CMD=\"\$1\"; W=\"\$2\"; timeout 10 cat /dev/at_mdm0 > /tmp/at_o 2>&1 & CP=\$!; sleep 0.5; printf \"%s\r\" \"\$CMD\" > /dev/at_mdm0; sleep \$W; kill \$CP 2>/dev/null; echo \"### \$CMD\"; tr -d \"\r\" < /tmp/at_o | grep -v \"^\$\" | head -15; }; 
run_at \"ATI\" 6;
run_at \"AT+SLMODE?\" 5;
run_at \"AT+BAND_PREF?\" 5;
run_at \"AT+ICCID\" 4;
run_at \"AT+CNUM\" 4;
" 2>&1 | grep -vE "^Warning"
