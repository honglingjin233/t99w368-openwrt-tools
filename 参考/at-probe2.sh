#!/bin/sh
# T99W368 Foxconn 私有指令实测（qmodem 权威指令集）
ADB=/usr/bin/adb
$ADB shell "run_at() { CMD=\"\$1\"; timeout 6 cat /dev/at_mdm0 > /tmp/at_o 2>&1 & CP=\$!; sleep 0.5; printf \"%s\r\" \"\$CMD\" > /dev/at_mdm0; sleep 3; kill \$CP 2>/dev/null; echo \"### \$CMD\"; tr -d \"\r\" < /tmp/at_o | grep -v \"^\$\" | head -12; }; 
run_at \"ATI\";
run_at \"AT+ICCID\";
run_at \"AT+CNUM\";
run_at \"AT+SLMODE?\";
run_at \"AT+BAND_PREF?\";
run_at \"AT+temp?\";
run_at \"AT!PCVOLT?\";
" 2>&1 | grep -vE "^Warning"
