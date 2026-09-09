# T99W368 模块内部功能全景 + AT 指令全集（2026-09-09 深挖）

## 一、模块内部系统架构（ADB root 探测）
- **系统**：Linux sdxlemur 5.4.147（Qualcomm SDX65/SDXLEMUR 平台），ARMv7，工程板无 adb 认证
- **网络栈进程**：mbimd（MBIM 栈）、netmgrd（数据面管理）、qmuxbridge（QMI 桥）、qrtr-ns（QMI 路由）、ipacm/ipacmdiag（IP 加速）
- **AT 引擎**：atfwd_daemon（AT 转发，radio 用户，socket 通信）
- **Foxconn 工具集**：fx_set_band（QMI PDC/DMS/NAS 锁频段守护）、fxdiag、fxgps（GNSS 会话控制）、fxlog、fxshutdown、fxwakebysms（短信唤醒：wake_lock+GPIO）、fxencrypt_example、fxfota
- **系统服务**：thermal-engine、qseecomd、time_daemon、logd、usbd、tftp_server、LwM2M_Client、QCMAP_Web_CLIENT（连接管理）
- **数据面**：rmnet_data0-15（模块内部 QMI 数据口，MBIM 对外封装）；erspan/gre 隧道（VPN 支持）
- **配置**：/etc/data/factory_mobileap_cfg.xml（AP）、factory_l2tp_cfg.xml（L2TP）、factory_qti_socksv5_conf.xml（SOCKS5）、factory_wlan_cfg.xml
- **调试产物**：/data/misc/at_*.sh（出厂 AT 脚本）、/data/local/tmp/*.pl/.sh（工程调试：初始化/PDP/切换）、st*.log（qbi MBIM strace）

## 二、AT 指令全集（连续发送模式实测）
### 标准 3GPP（全部有效）
| 指令 | 说明 |
|------|------|
| `AT` / `ATE` | 握手 / 回显开关 |
| `ATI` | 模块信息（Manufacturer/Model T99W368/Revision/IMEI/SVN）|
| `AT+CGMR` `AT+CGSN` `AT+CIMI` | 固件 / IMEI / IMSI |
| `AT+COPS?` | 运营商（文本乱码→qmodem 用 AT+COPS=3,2 数值）|
| **`AT+C5GREG?`** | **5G 注册（0,1=已注册）** |
| `AT+CREG?` `AT+CGREG?` `AT+CEREG?` | CS/GPRS/LTE 注册（NSA 下 0,0）|
| `AT+CFUN?` / `AT+CFUN=1` | 射频功能 / 开启 |
| `AT+CPIN?` | SIM 状态 |
| `AT+CGDCONT?` | PDP 上下文列表（4/5=cmnet，2=ims，3=sos）|
| `AT+CGACT?` / `AT+CGACT=1,<id>` / `AT+CGACT=0` | 上下文激活状态 / 激活 / 去激活 |
| `AT+CGPADDR=<id>` | 上下文 IP |
| **`AT+CGCONTRDP=<id>`** | **完整 PDP（IP+DNS，比 netifd 可靠）** |
| `AT+CSQ` | 信号（MBIM 下 99,99）|
| `AT+CMGF?` | 短信格式（PDU 0）|
| `AT+temp?` | **温度（PA/TSENS/Skin/Ambient）** |

### Foxconn 私有（查询有效）
| 指令 | 说明 |
|------|------|
| `AT+BOOT_VER?` | SBL 0.0.1.15 / UEFI 004 |
| `AT+PLATFORM?` | 平台 0 |
| `AT+CUSTOMER?` | 客户定制 0 |
| `AT+PCIEMODE?` | PCIe 模式 0（USB）|
| `AT+FXLOGLVL?` | 日志级别 3 |
| `AT+MODESWITCH?` | USB 模式 0（**设置=红线！**）|

### 不支持（实测 ERROR/无响应）
Quectel Q 系列（QENG/QCAINFO/QNWINFO/QSIMSTAT）、CNMP、CONSOLELOG?、BOOTVAL?、CMGL（短信 AT 不可用→走 MM）、ICCID、CNUM（空）

### 🔴 红线（atfwd strings 确认存在，绝不执行）
`+MODESWITCH=`（USB 模式切换）、`+DIAG_ENABLE`、`+EDL`、`+EFS_ERASE`、`+RESET`、`+FASTBOOT`、`+FFOTADL`、`+FFOTAUPGRADE`——涉及 USB 切换/擦写/下载模式，可能触发模块保护（曾软锁死送修）

## 三、模块功能能力（深挖结论）
| 功能 | 状态 |
|------|------|
| 5G/LTE 数据 | MBIM 栈（mbimd/netmgrd）正常 |
| 短信 | **AT 直读不支持（CMGL ERROR）**→ 必须 MM/MBIM 服务（现插件方案正确）|
| 制式/频段 | MM（allowed-modes/bands）；模块内部 fx_set_band（QMI）；AT CNMP 不支持 |
| 温度 | AT+temp?（已集成插件）|
| GPS/GNSS | 模块支持（fxgps 会话控制 + 接口 1.4 GNSS 口），但 OpenFi MBIM 模式 GNSS 口未暴露，启用需 USB 接口配置（红线区，跳过）|
| 短信唤醒 | fxwakebysms 支持（需 GPIO 硬件接线，OpenFi 上用不了）|
| VPN 客户端 | 模块内置 L2TP/SOCKS5 配置（QCMAP 连接管理）|
| CA 聚合明细 | **三路径（MM/MBIM/AT）确认不可获取**（工程板固件不暴露）|

## 四、全盘遍历补充发现（2026-09-09 遍历 /data /etc /usr /WEBSERVER /system /persist）
- **QCMAP 完整 Web 管理界面**（/WEBSERVER/www：QCMAP_WWAN/IPV4/IPV6/NAT/Firewall/Account.html）——模块可作独立 CPE（NAT/防火墙/WWAN 管理），但当前 MBIM modem 模式未启用（启用需 MODESWITCH=红线）
- **QMI 工具集**（/usr/bin）：rmnetcli（数据面 CLI）、qmi_ip_multiclient、qmi_simple_ril_test、qmi_test_service_*（测试）
- **工程师 QMI Perl 脚本**（/data/misc 56 个）：qmi_wds_start.pl（手写 QMI WDS 拨号：APN TLV+start_network 0x0020）、probe_qrtr*.pl、scan_qrtr_ports.pl、qrtr_full_scan.pl、qmi_smd_test.pl——**模块内部 QMI QRTR 通道完整**（qrtr-ns 运行）
- **port_bridge**（AT 端口桥工具）
- **/system/rfs/mdm**（adsp/mpss 调制解调器固件分区）
- **运营商配置**：/etc/data/data_iot/（LwM2M bootstrap.ini、lwm2m_cfg_verizon、carrier_apn_cfg_firstnet）
- **IP 加速配置**：/etc/data/ipa/IPACM_cfg.xml；netmgr_config.xml；adpl_config（<mode>0</mode>）
- **at_out3.txt 佐证**：CFUN:0 状态 + QSIMSTAT/QNWINFO/QENG 全 ERROR（Quectel 指令三次确认不可用）
- **无更多 AT 指令/配置遗漏**：AT 指令集完整（atfwd strings + 全部 at_*.sh/pl 已读），无额外 AT 功能开关
