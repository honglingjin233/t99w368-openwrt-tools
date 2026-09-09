# T99W368 OpenWrt 5G 模块管理工具集

Foxconn T99W368（Qualcomm SDX65/SDXLEMUR 平台）5G 模块在 OpenWrt 上的完整适配资料：
LuCI 管理插件、AT 指令逆向成果、模块内部架构分析。

## 📦 内容

```
├── modem5g-plugin/          LuCI 管理插件（rpcd ucode 后端 + LuCI 前端 + 运维脚本）
│   ├── modem5g.uc           后端：状态/控制/短信/AT 查询全部方法
│   ├── modem5g-status.js    前端：状态卡/控制区/短信区（默认折叠防泄露）
│   ├── modem5g-acl.json     rpcd 权限白名单
│   ├── m5g-*.sh             运维脚本（看门狗/扫描/复位恢复/短信回切/AT 查询）
│   └── 安装部署说明.md      部署/回滚步骤
├── 文档/
│   ├── AT_commands.md       AT 指令全集（实测表 + 格式分析 + 红线指令）
│   ├── MODULE_INFO.md       模块内部全景（进程/工具/配置/能力）
│   └── 工作进度总结.md      完整工作记录
├── 参考/
│   ├── qmodem-*.sh          qmodem 官方 T99W368 支持脚本
│   └── at-list-sdxlemur.md  SDXLEMUR 平台 AT 列表
└── T99W368_OpenFi6C_完整适配文档.md  方案 C 完整适配记录
```

## ✨ 插件功能

- **状态三卡**：连接状态（5G 载波/LTE 锚点信号 RSRP/SINR）、模块信息（IMEI/ICCID/IMSI/温度）、数据面（IP/会话流量）
- **控制操作**：重拨/制式切换/频段锁定/电源/复位/网络扫描/APN/Ping 诊断/USSD/看门狗/AT 查询
- **短信**：4G 收发自动化（发送自动切 4G 并回 5G）、收信窗口 120s 自动回切、收件箱默认折叠防泄露
- **可靠性**：数据面看门狗（真实连通验证）、Modem 索引动态校准、全中文界面

## 🔬 关键成果

- **AT 通道**：ADB 进模块内部 root → `/dev/at_mdm0` AT 引擎（连续发送模式，模块对频繁开关节点不稳定）
- **实测指令**：标准 3GPP 全套（含 C5GREG? 5G 注册、CGCONTRDP 数据面 IP/DNS）+ Foxconn 私有查询
- **格式结论**：T99W368 = Foxconn 固件（AT+ 前缀），无 Quectel Q 系列指令
- **红线**：AT+USBSWITCH / +MODESWITCH / +DIAG_ENABLE / +EDL / +EFS_ERASE 等绝不执行（模块曾有 USB 模式切换软锁死送修史）

## ⚠️ 隐私说明

公开仓库已对设备标识（IMEI/IMSI/ICCID）脱敏。

## 平台

- OpenWrt 官方 snapshot（apk 包管理）+ ModemManager 栈
- 适配机型：Foxconn T99W368（VID:PID 05c6:90d5）
