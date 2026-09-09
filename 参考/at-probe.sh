#!/bin/sh
# T99W368 AT 命令有效性探测（通过 ADB + /dev/at_mdm0）
ADB=/usr/bin/adb
run_at() {
	CMD="$1"
	timeout 5 cat /dev/at_mdm0 > /tmp/at_o 2>&1 &
	CP=$!
	sleep 0.5
	printf "%s\r" "$CMD" > /dev/at_mdm0
	sleep 2
	kill $CP 2>/dev/null
	RESP=$(tr -d "\r" < /tmp/at_o | grep -v "^$" | tr "\n" "|")
	echo "[$CMD] => $RESP"
}

echo "===== ADB root 检查 ====="
$ADB shell "id" 2>&1 | head -1

echo "===== 标准 3GPP 指令探测 ====="
for C in \
	"ATI" \
	"AT+CGMI" \
	"AT+CGMM" \
	"AT+CCID?" \
	"AT+ICCID?" \
	"AT+CPIN?" \
	"AT+CREG?" \
	"AT+CGREG?" \
	"AT+CGDCONT?" \
	"AT+CFUN?" \
	"AT+CMEE?" \
	"AT+CNUM" \
	"AT+CMGF?" \
	"AT+CMGL=\"ALL\"" \
	; do
	$ADB shell "run_at() { CMD=\"\$1\"; timeout 5 cat /dev/at_mdm0 > /tmp/at_o 2>&1 & CP=\$!; sleep 0.5; printf \"%s\r\" \"\$CMD\" > /dev/at_mdm0; sleep 2; kill \$CP 2>/dev/null; tr -d \"\r\" < /tmp/at_o | grep -v \"^\$\" | tr \"\n\" \"|\"; }; run_at \"$C\"" 2>&1 | tr -d "\r" | head -3
done

echo "===== Foxconn/平台私有指令 ====="
for C in \
	"AT+CUSTOMER?" \
	"AT+CUSTOMER" \
	"AT+CGMR=?" \
	; do
	$ADB shell "run_at() { CMD=\"\$1\"; timeout 5 cat /dev/at_mdm0 > /tmp/at_o 2>&1 & CP=\$!; sleep 0.5; printf \"%s\r\" \"\$CMD\" > /dev/at_mdm0; sleep 2; kill \$CP 2>/dev/null; tr -d \"\r\" < /tmp/at_o | grep -v \"^\$\" | tr \"\n\" \"|\"; }; run_at \"$C\"" 2>&1 | tr -d "\r" | head -3
done
