# modem5g 插件 v5 多模组适配层（三模组实测校准）

> 2026-09-10 三台实机探测校准：T99W368(OpenFi6C) / FM350-GL(M28C) / RM500Q-CN(本机 COM14)
> 本版核心变化：适配表从「仅温度命令」扩展为「通道 + 命令」双维度，按模组分发。

## 一、三模组 AT 命令差异（实测真值）

| 能力 | T99W368 (Foxconn/SDXLEMUR) | FM350-GL (Fibocom) | RM500Q-CN (Quectel) |
|---|---|---|---|
| AT 通道 | **ADB** (/dev/at_mdm0) | **USB 串口** /dev/ttyUSB1 | **USB 串口** /dev/ttyUSB2 |
| 识别 | ATI | ATI | ATI |
| 温度 | `AT+temp?` → `TSENS: 38C` | `AT+GTSENRDTEMP=1` | `AT+QTEMP`（**无问号**，`+QTEMP:"aoss0-usr","34"`） |
| 5G 信号 | `AT+QENG="servingcell"` | **`AT+CESQ`**（QENG/QTEMP/QNWPREFCFG 全 ERROR） | `AT+QENG="servingcell"`（**必须双引号**，单引号 ERROR） |
| 频段查询 | MM ngran（mbim） | `AT+GTACT=,,?`（锁频 `AT+GTACT=,,,band`） | `AT+QNWPREFCFG="nr5g_band"`（**带引号**） |
| 制式切换族 | AT+CFUN | AT+CFUN | `AT+QNWPREFCFG="mode_pref"` |
| 拨号协议 | MBIM | RNDIS（M28C 实测 eth1） | QMI |
| 小区锁定 | fx 系（AT+QENG?） | `AT+GTCELLLOCK=1,1,0,arfcn,pci,scs,band` | `AT+QNWLOCK="common/5g",pci,arfcn,scs,band` |

**重要修正（相对 v4）**：
- v4 将 FM350/RM500 温度都写成 `AT+QTEMP?` → **实测均 ERROR**（FM350 用 GTSENRDTEMP=1，RM500 用 AT+QTEMP 无问号）
- v4 统一 `AT+QENG='servingcell'`（单引号）→ **RM500 单引号 ERROR、FM350 不支持 QENG**
- T99W368 不在 QModem 官方支持列表（modem_support.json 仅 t99w175/373/640）——本适配表为自研逆向成果

## 二、后端改动（modem5g.uc.v4）

1. **MODULE_ADAPTERS 扩展**：每模组含 ifname/proto/vendor/channel/temp_cmd/temp_re/sig_cmd/sig_kind/band_read/mode_cmd/bands_profile/at_port
2. **atQuery(model, cmd, cache)**：通道分发——T99 走 `m5g-at.sh`（ADB），其余走新增 `m5g-at-serial.sh <端口>`（USB 串口）
3. **temp 方法**：按适配表 temp_cmd + temp_re 三分发（TSENS / GTSENRDTEMP / QTEMP 三种响应正则）
4. **AT 白名单扩展**：允许 `AT+CESQ` / `AT+GTSENRDTEMP=1` / `AT+QENG="servingcell"` / `AT+QNWPREFCFG="..."` 只读形态
5. **mmcli 缺失检测**：status 返回 `mm_ok:false + 提示`（M28C 等无 ModemManager 环境优雅降级，不崩溃）
6. **module_profile 增强**：输出完整能力元数据（前端能力矩阵数据源）

## 三、新增脚本 m5g-at-serial.sh

通用 USB 串口 AT 通道（FM350/RM500 等非 ADB 模组）：
- 白名单含双引号/逗号（支持 QNWPREFCFG 类命令）
- 与 m5g-at.sh 同款 mkdir 串行锁（独立锁名 /tmp/m5g-at-ser.lock）
- 绝对超时 6s + OK/ERROR 提前退出 + 可选 60s 缓存
- 用法：`m5g-at-serial.sh <端口> "<AT指令>" [cache]`

## 四、前端改动（modem5g-status.v4.js）

1. **AT 快捷命令按模组动态**：T99 全套 / FM350（CESQ+GTSENRDTEMP+CGPADDR=3）/ RM500（QENG+QTEMP+QNWPREFCFG）
2. **适配层富文本**：模块信息卡"适配层"行展开为厂商/通道/拨号/温度/信号/频段/制式/AT口 多行
3. **模组能力矩阵**（高级设置内）：三模组对照表（通道/温度/信号/频段/拨号协议 5 行）

## 五、部署状态

| 目标 | 地址 | 状态 |
|---|---|---|
| Debian（源码目录） | 192.168.100.148 /home/hong/桌面/T99W368/modem5g-plugin/ | ✅ 已推送 v4（新） |
| OpenFi6C（T99W368 真机） | 192.168.21.1 | ✅ 已部署 + ubus 真机验证（module_profile 返回新字段） |
| M28C（FM350-GL 实机） | 192.168.28.1 | ✅ 已部署 + 验证降级提示 |

**OpenFi6C 部署教训**：rpcd ucode 目录**不要放 .bak 文件**（会被 rpcd 按同名加载并覆盖新文件）——备份移出该目录。

## 六、M28C 说明

- M28C 未安装 ModemManager（mmcli 不存在），FM350 由 QModem 托管（RNDIS/eth1）
- 插件在 M28C 加载正常，status 返回 `mm_ok:false` 明确提示
- **若要完整使用插件**：`opkg install modemmanager`（注意与 QModem 的拨号管理并存策略，FM350 走 MM 时适配表自动命中 FM350-GL）
- FM350 的 AT 口实测为 /dev/ttyUSB1（QModem get_at_cfg valid_ports 确认）
