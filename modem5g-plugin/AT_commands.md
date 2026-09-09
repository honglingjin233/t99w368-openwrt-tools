# T99W368 AT 指令逆向 —— 实测指令表（2026-09-09 最终版）

> **重大突破**：通过 **ADB 进入模块内部** → root 提权 → `/dev/at_mdm0`（模块 AT 引擎节点）→ 可执行 AT 命令！

## 🔓 AT 通道（已验证）
```
adb 连接：/usr/bin/adb devices → 1d0e9301 device
adb root → uid=0
AT 引擎：/dev/at_mdm0（root 可读写）
执行：cat 保持打开 /dev/at_mdm0 + printf "AT+xxx\r" > /dev/at_mdm0
```
- 模块内部系统：Linux sdxlemur 5.4.147（Qualcomm SDX 平台），非 root 时 AT 节点属 radio 组（uid 2000 无权限）→ 必须 adb root
- adb 客户端来源：OpenWrt 21.02 aarch64_cortex-a53 `adb_android.5.0.2_r1-3` ipk 提取 + libopenssl1.1（libcrypto.so.1.1）+ libgcc_s.so.1（immortalwrt 工具链）

## ✅ 实测可用的指令（Foxconn 固件标准 3GPP 子集 + 少量扩展）
| 指令 | 实测输出 |
|------|---------|
| `AT` | OK |
| `ATI` | Manufacturer: Qualcomm / **Model: T99W368** / Revision: FDE.F0.0.0.1.3.DF.004 / IMEI / SVN / MPN |
| `AT+CGMR` | FDE.F0.0.0.1.3.DF.004 [Apr 05 2023]（固件版本）|
| `AT+CGSN` | 35518383******（IMEI）|
| `AT+CIMI` | 46000808******（IMSI）|
| `AT+CSQ` | 99,99（MBIM 模式下信号未知）|
| `AT+COPS?` | +COPS: 0,0,"???? CMCC",11（11=NR5G；文本运营商乱码是固件特性）|
| **`AT+C5GREG?`** | **+C5GREG: 0,1（5G 注册查询！CEREG 在 5G 下显示 0,0，要查 C5GREG）** |
| `AT+CFUN?` | +CFUN: 1（射频全功能）|
| `AT+CEREG?` / `AT+CREG?` / `AT+CGREG?` | 0,0（LTE/CS/GPRS 域注册，5G NSA 下无）|
| `AT+CPIN?` | +CPIN: READY |
| `AT+CGDCONT?` | 5 个 PDP 上下文（4/5=cmnet，2=ims，3=sos）|
| `AT+CGACT?` | 上下文激活状态（当前 5 激活）|
| `AT+CGPADDR=5` | 上下文 5 的 IP |
| **`AT+CGCONTRDP=5`** | **当前数据面完整 PDP：cmnet + IP + DNS（比 netifd 缓存可靠！）** |
| `AT+CMGF?` | +CMGF: 0（PDU 模式）|
| `AT+temp?` | **PA/TSENS/Skin/Ambient 温度传感器** |

> 🔑 **重要方法论（2026-09-09 修正）**：AT 引擎对**频繁开关 /dev/at_mdm0** 不稳定（每条单独 open/write/close 会丢命令/无响应）！**必须用连续发送模式**（cat 保持打开 + 顺序发多条 + 一次读取）——此模式下方可挖出 C5GREG/CGDCONT/CGACT/CGCONTRDP 等全部标准指令。**首次探测"无响应"的指令多数是方法问题**（含曾误判的 CREG?/CGREG?/CFUN?/CGDCONT?），真正 ERROR 的只有 Quectel Q 系列 + QSIMSTAT。

## 🔬 命令格式分析（用户问的"工程板固件是否改了格式"——结论）
1. **T99W368 = Foxconn 固件（FDE 2023 测试版），非 Quectel 格式**：**无 Quectel Q 系列**（AT+QENG/AT+QCAINFO/AT+QNWPREFCFG 全部实测 ERROR/无响应）
2. **非完整 Foxconn 私有集**：qmodem foxconn.sh（权威）里的 AT+SLMODE?(制式)/AT+BAND_PREF?(锁频段)/AT+debug?(小区+CA nr_scc1)/AT+ICCID/AT+CNUM/AT!PCVOLT? **在本模块实测均无响应**——**比 qmodem 期望的更精简**（只保留标准查询 + ATI + 温度）
3. **T99W 系列格式不统一**：T99W175（Intel 平台）用 **AT^ 前缀**；T99W368/T99W640（Qualcomm 平台）用 **AT+ 前缀**；`AT!PCVOLT?` 是 AT! 前缀（电压查询，本模块不支持）
4. **CA 聚合最终确认**：AT+debug?（qmodem 的 CA 检测源，nr_scc1 辅载波）**本模块不支持**——CA 明细经 MM/MBIM/AT 三条路径全部确认不可获取（工程板固件不暴露）
5. 参考来源：qmodem PR#244 T99W368 官方支持（AT 口=接口1.5/ttyUSB3、AT+COPS=3,2 数值格式）、Linux kernel option 补丁（proto40=Modem/AT 口）、cellular-modem-wiki sdxlemur（smd7/smd11 AT 通道）、GL.iNet T99W175 帖（AT+CUSTOMER=0/8、默认 9600 波特率）

## ❌ 实测不可用（关键结论）
| 指令 | 结果 |
|------|------|
| `AT+QCAINFO` | **ERROR**（Quectel 私有 CA 指令，Foxconn 固件不支持）|
| `AT+QENG="servingcell"` | 无响应（不支持 Quectel 扩展）|
| `AT+QNWPREFCFG` | 无响应（不支持）|
| `AT+CLAC` | 无响应（精简固件无此指令）|

## 📌 最终结论
- **AT 通道已完全打通**（ADB 路径，可执行标准 AT 查询）
- **CA 聚合明细确认不可获取**：Foxconn 工程版固件 AT 引擎仅标准 3GPP 子集，**无任何 CA/深度信号查询指令**（QCAINFO 明确 ERROR）——与 MM/MBIM 路径结论一致，模块固件不暴露 CA 明细
- 信号（AT+CSQ）在 MBIM 模式下返回 99 未知——AT 引擎与射频子系统接口受限
- 信息获取仍以 **MM/QMI** 为最优（信号/频段/注册全覆盖），AT 通道用于标准指令（身份/版本/运营商）补充验证
