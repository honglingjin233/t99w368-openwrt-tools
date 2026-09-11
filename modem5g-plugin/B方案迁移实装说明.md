# B 方案前端迁移实装说明（modem5g-status.v4.js → 6 页导航）

## 一、迁移目标
将 `modem5g_b_migration/index.html`（B 方案 6 页导航）迁移到真实 LuCI 插件前端，不引入
ECharts/CDN 依赖（LuCI 环境全内联 SVG），全部数据接真实 RPC。

## 二、页面结构（原 4 tab → 6 tab）

| Tab | 内容 | 数据源 |
|-----|------|--------|
| 仪表盘 dash | 6 KPI（连接状态/信号强度/实时速率/今日流量/本月流量/模块温度）+ 6 图（RSRP/SINR/温度/速率折线 + 近7日流量柱状 + 今日信号范围带） | status/temp/trend/speed/traffic_stats/deep_signal |
| 网络状态 netstat | 6 块：信号卡 / 载波聚合·小区 / 网络状态 / 模块信息 / 数据面 / 网络质量 Ping | status/deep_signal/ping_test |
| 网络配置 config | 制式 / 频段锁定 / APN / 模组能力矩阵 / 智能选网（5 块）+ 操作区（重拨/扫描/电源） | set_mode/set_bands/set_apn/signal_guard |
| 短信中心 sms | 发送 + 收件箱列表（原有） | sms_list/sms_send/sms_delete |
| AT 调试 at | AT 查询（适配层按模组动态指令）/ USSD / 一键诊断 | at_cmd/ussd_query/diagnostic |
| 系统设置 sys | 看门狗（开关+事件时间线）/ 一键体检 / LED 联动 / 端口转发防火墙（只读）/ 端口信息 | watchdog_*/health_check/list_leds/led_map/netfilter_status |

## 三、新增/改动点
1. **diagSection 拆分**：原折叠"诊断工具"拆为 `atSection`（AT/USSD/诊断）+ `sysSection`
   （看门狗/体检/LED/防火墙/端口）+ `pingCard`（独立网络质量卡入 netstat 6 块）。
2. **新增 2 个 SVG 图函数**：
   - `flowBars(days)`：近 7 日流量柱状（rx 绿 / tx 橙堆叠，traffic_stats.days）
   - `sigBand(r)`：今日 RSRP 范围带（min~max 区间 + avg 标记 + 温度均，deep_signal.today_*）
3. **新增载波聚合·小区卡（caCard）**：制式 + 5G 频段 chips + LTE RSRP/SINR + CA 说明
   （数据全部来自 deep_signal，不编造 PCI/小区 ID）。
4. **panels 4→6**：overview→dash（KPI+6图），新增 netstat/at/sys；旧 tab 记忆兼容
   （overview→dash）。
5. 全部 RPC/组件复用，无新增后端方法。

## 四、部署状态（2026-09-10）
- **Debian 源码**：/home/hong/桌面/T99W368/modem5g-plugin/modem5g-status.v4.js（91660B）
- **OpenFi6C**：/www/luci-static/resources/view/modem5g/status.js = 91660B ✔ 关键字验证
  （仪表盘/网络状态/网络配置/短信中心/AT 调试/系统设置 全命中，flowBars/sigBand 命中）
- **M28C**：/www/luci-static/resources/view/modem5g/status.js = 91660B ✔（channel stdin 写入）
  注意：M28C 无 ModemManager，模块数据走 QModem 托管 + 降级提示。

## 五、验证
- node --check 通过
- 拆分引用完整性：atSection/sysSection/pingCard 引用的 23 个变量全部在定义后使用
- 三端字节一致（91660）
- 刷新 OpenFi6C LuCI 页面即可验收（浏览器强缓存可 Ctrl+F5）
