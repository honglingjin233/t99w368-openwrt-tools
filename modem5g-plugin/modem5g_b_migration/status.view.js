'use strict';
'require view';
'require rpc';

/* B 方案前端 · LuCI2 view 整合版（status.js）
   由 index.html + app.js 自动生成；rpc 走 LuCI 会话认证，实时模式 */
var HTML_STR = `<div id="m5g-root">
<style>
#m5g-root{
--primary:#1677ff; --bg:#f5f6f8; --card:#fff; --line:#e5e6eb;
--text:#1f2329; --sub:#8a919f; --ok:#52c41a; --warn:#faad14; --bad:#f5222d;
}
#m5g-root *{box-sizing:border-box;margin:0;padding:0}
#m5g-root{font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);font-size:14px}
#m5g-root .topbar{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
#m5g-root .topbar-in{max-width:1200px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
#m5g-root .brand{font-size:16px;font-weight:700}
#m5g-root .brand small{font-size:12px;color:var(--sub);font-weight:400;margin-left:8px}
#m5g-root .nav{display:flex;gap:2px;flex-wrap:wrap}
#m5g-root .nav a{display:block;padding:7px 14px;border-radius:6px;color:#4e5969;text-decoration:none;font-size:13px}
#m5g-root .nav a:hover{background:#eef3ff;color:var(--primary)}
#m5g-root .nav a.on{background:var(--primary);color:#fff}
#m5g-root .demo-tag{font-size:11px;color:var(--warn);background:#fff7e6;border:1px solid #ffd591;padding:2px 8px;border-radius:4px;margin-left:auto}
#m5g-root .demo-tag.api{color:var(--ok);background:#e8f7e8;border-color:#b7eb8f}
#m5g-root main{max-width:1200px;margin:0 auto;padding:16px}
#m5g-root .page{display:none}
#m5g-root .page.on{display:block}
#m5g-root .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
#m5g-root .kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
#m5g-root .kpi .lbl{font-size:12px;color:var(--sub)}
#m5g-root .kpi .val{font-size:24px;font-weight:700;margin-top:4px}
#m5g-root .kpi .val small{font-size:12px;color:var(--sub);font-weight:400}
#m5g-root .kpi .sub{font-size:12px;color:var(--sub);margin-top:2px}
#m5g-root .panel{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:16px}
#m5g-root .panel h3{font-size:14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#m5g-root .panel h3 .dot{width:6px;height:6px;border-radius:50%;background:var(--primary);display:inline-block}
#m5g-root .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}
#m5g-root .chart{width:100%;height:260px}
#m5g-root .host-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;height:260px;align-content:stretch}
#m5g-root .host-card{background:var(--bg,#f7f8fa);border:1px solid var(--line);border-radius:8px;padding:6px 10px;display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:hidden}
#m5g-root .host-lbl{font-size:10px;color:var(--sub);white-space:nowrap}
#m5g-root .host-val{font-size:16px;font-weight:700;margin-top:2px;white-space:nowrap;line-height:1.2}
#m5g-root .host-val small{font-size:9px;color:var(--sub);font-weight:400}
#m5g-root .host-sub{font-size:9px;color:var(--sub);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#m5g-root .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 24px}
#m5g-root .kv .it{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px dashed #f0f1f3}
#m5g-root .kv .it .k{color:var(--sub)}
#m5g-root .kv .it .v{font-weight:600}
#m5g-root .bar-wrap{margin:10px 0}
#m5g-root .bar-top{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
#m5g-root .bar-top .b-v{font-weight:600}
#m5g-root .bar{background:#f0f1f3;height:10px;border-radius:5px;overflow:hidden}
#m5g-root .bar i{display:block;height:100%;border-radius:5px}
#m5g-root .g{background:var(--ok)}
#m5g-root .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
#m5g-root .chip{padding:4px 12px;border:1px solid var(--line);border-radius:14px;font-size:12px;color:#4e5969;cursor:pointer;user-select:none}
#m5g-root .chip.on{background:var(--primary);border-color:var(--primary);color:#fff}
#m5g-root .btn{display:inline-block;padding:6px 16px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer}
#m5g-root .btn.ghost{background:#fff;color:var(--primary);border:1px solid var(--primary)}
#m5g-root .btn.danger{background:var(--bad)}
#m5g-root .btn.dirty{background:#faad14;color:#000}
#m5g-root .btn:active{opacity:.85}
#m5g-root .btn:disabled{opacity:.5;cursor:not-allowed}
#m5g-root .input{padding:6px 12px;border:1px solid var(--line);border-radius:6px;font-size:13px;outline:none;width:100%}
#m5g-root .input:focus{border-color:var(--primary)}
#m5g-root .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#m5g-root table{width:100%;border-collapse:collapse;font-size:13px}
#m5g-root th,#m5g-root td{padding:8px 10px;border-bottom:1px solid #f0f1f3;text-align:left}
#m5g-root th{color:var(--sub);font-weight:500;background:#fafbfc}
#m5g-root .badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px}
#m5g-root .badge.g{background:#e8f7e8;color:var(--ok)}
#m5g-root .badge.r{background:#fff1f0;color:var(--bad)}
#m5g-root .sms-item{padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin:8px 0;font-size:13px}
#m5g-root .sms-item .h{display:flex;justify-content:space-between;color:var(--sub);font-size:12px;margin-bottom:4px}
#m5g-root .term{background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-family:Consolas,Menlo,monospace;font-size:12px;min-height:180px;white-space:pre-wrap;overflow:auto}
#m5g-root .at-short{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#m5g-root .at-short button{padding:4px 12px;border:1px solid var(--line);border-radius:14px;background:#fff;font-size:12px;cursor:pointer}
#m5g-root .at-short button:hover{border-color:var(--primary);color:var(--primary)}
#m5g-root .toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#2b2f36;color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .25s;z-index:99;pointer-events:none}
#m5g-root .toast.show{opacity:1}
#m5g-root .sms-tabs{display:flex;gap:8px;margin-bottom:10px}
#m5g-root .sms-tab{padding:4px 14px;border:1px solid var(--line);border-radius:14px;font-size:12px;cursor:pointer;color:#4e5969;user-select:none}
#m5g-root .sms-tab.on{background:var(--primary);border-color:var(--primary);color:#fff}
#m5g-root .sms-item{cursor:pointer;transition:border-color .15s}
#m5g-root .sms-item:hover{border-color:var(--primary)}
#m5g-root .sms-item .clip{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:#333;line-height:1.5}
#m5g-root #sms-list{flex:1 1 auto;min-height:0;overflow-y:auto}
#m5g-root .badge-u{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--primary);margin-right:6px;vertical-align:middle}
#m5g-root .modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:120}
#m5g-root .modal-mask.show{display:flex}
#m5g-root .modal{background:#fff;border-radius:10px;padding:18px;max-width:520px;width:92%;max-height:78vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.18)}
#m5g-root .modal-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
#m5g-root .modal-x{cursor:pointer;font-size:20px;color:var(--sub);line-height:1}
#m5g-root .sms-full{font-size:13px;line-height:1.7;white-space:pre-wrap;background:#f7f8fa;border:1px solid var(--line);border-radius:8px;padding:10px;max-height:200px;overflow:auto}
#m5g-root .sms-meta{font-size:12px;color:var(--sub);margin-bottom:8px;line-height:1.8}
#m5g-root .wd-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#m5g-root .wd-bar .btn{padding:3px 12px;font-size:12px}
#m5g-root .switch{position:relative;display:inline-block;width:40px;height:22px;vertical-align:middle}
#m5g-root .switch input{display:none}
#m5g-root .switch i{position:absolute;inset:0;background:#c9cdd4;border-radius:11px;transition:.2s}
#m5g-root .switch i::after{content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s}
#m5g-root .switch input:checked+i{background:var(--ok)}
#m5g-root .switch input:checked+i::after{transform:translateX(18px)}
#m5g-root .warn-banner{background:#fff7e6;border:1px solid #ffd591;color:#ad6800;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:12px}
#m5g-root .danger-zone{border:1px dashed #ffccc7;background:#fff2f0;border-radius:8px;padding:12px}
#m5g-root .danger-zone .dz-title{color:var(--bad);font-size:13px;font-weight:600;margin-bottom:8px}
#m5g-root .mono{font-family:Consolas,Menlo,monospace;font-size:12px}
/* 网络状态页：数据面移至载波聚合下方，基本信息与信号板同列 */
#m5g-root #page-sms .grid2{grid-template-columns:1fr 1fr}
#m5g-root #page-sms .grid2 > .panel{height:380px;box-sizing:border-box;display:flex;flex-direction:column}
#m5g-root #page-sms .grid2 > .panel > h3{flex:none}
#m5g-root #page-sms .grid2 > .panel > .row:last-child{margin-top:auto;flex:none}
#m5g-root #page-sms .grid2 > .panel > textarea{flex:none}
#m5g-root #page-sms .grid2 > .panel > .row:nth-child(2){flex:none}
#m5g-root #page-sms .sms-tabs{flex:none}
@media(max-width:760px){#m5g-root #page-sms .grid2{grid-template-columns:1fr}}
#m5g-root #page-network-status .grid2{grid-template-columns:repeat(3,1fr)}
#m5g-root #page-network-status .grid2 > .panel:nth-child(1){grid-column:1;grid-row:1}
#m5g-root #page-network-status .grid2 > .panel:nth-child(2){grid-column:2;grid-row:1}
#m5g-root #page-network-status .grid2 > .panel:nth-child(3){grid-column:3;grid-row:1}
#m5g-root #page-network-status .grid2 > .panel:nth-child(4){grid-column:3;grid-row:2}
#m5g-root #page-network-status .grid2 > .panel:nth-child(5){grid-column:2;grid-row:2}
#m5g-root #page-network-status .grid2 > .panel:nth-child(6){grid-column:1;grid-row:2}
/* 仪表盘图表区：3 列 x 2 行，窄屏降列 */
#m5g-root #dash-charts{grid-template-columns:repeat(3,1fr)}
@media(max-width:1100px){#m5g-root #dash-charts{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){#m5g-root #dash-charts{grid-template-columns:1fr}}
/* 网络配置页：行1 三块 + 行2 小区锁定 | 邻区扫描（跨 2 列） */
#m5g-root #page-network-config .grid2{grid-template-columns:repeat(3,1fr)}
#m5g-root #page-network-config .grid2 > .panel:nth-child(1){grid-column:1;grid-row:1}
#m5g-root #page-network-config .grid2 > .panel:nth-child(2){grid-column:2;grid-row:1}
#m5g-root #page-network-config .grid2 > .panel:nth-child(3){grid-column:3;grid-row:1}
#m5g-root #page-network-config .grid2 > .panel:nth-child(4){grid-column:1;grid-row:2}
#m5g-root #page-network-config .grid2 > .panel:nth-child(5){grid-column:2 / span 2;grid-row:2}
@media(max-width:1100px){
#m5g-root #page-network-config .grid2{grid-template-columns:1fr}
#m5g-root #page-network-config .grid2 > .panel{grid-column:auto;grid-row:auto}
}
/* 制式分段控件 */
#m5g-root .seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
#m5g-root .seg .seg-it{padding:6px 14px;font-size:13px;cursor:pointer;border-right:1px solid var(--line);background:#fff;color:#4e5969;user-select:none}
#m5g-root .seg .seg-it:last-child{border-right:none}
#m5g-root .seg .seg-it.on{background:var(--primary);color:#fff}
#m5g-root td .num{font-family:Consolas,Menlo,monospace}
#m5g-root table tbody tr:hover{background:#fafbfc}
@media(max-width:980px){
#m5g-root #page-network-status .grid2{grid-template-columns:1fr}
#m5g-root #page-network-status .grid2 > .panel{grid-column:auto;grid-row:auto}
}
@media(max-width:640px){#m5g-root .chart{height:200px}}

#m5g-root .kv .it .v.mono{word-break:break-all;overflow-wrap:anywhere}
#m5g-root .kpi{min-height:92px}
</style>

<div class="topbar">
  <div class="topbar-in">
    <div class="brand">5G 模组管理<small id="brand-model">SDXLEMUR-SD-MTP · 多模组适配</small></div>
    <nav class="nav" id="nav">
      <a href="#/dashboard" data-p="dashboard">仪表盘</a>
      <a href="#/network-status" data-p="network-status">网络状态</a>
      <a href="#/network-config" data-p="network-config">网络配置</a>
      <a href="#/sms" data-p="sms">短信中心</a>
      <a href="#/atdebug" data-p="atdebug">AT 调试</a>
      <a href="#/system" data-p="system">系统设置</a>
    </nav>
    <span class="demo-tag" id="mode-tag">连接中…</span>
  </div>
</div>
<main id="m5g-main">

<!-- ===== 视图：仪表盘 ===== -->
<section class="page" id="page-dashboard">
  <div class="warn-banner" id="wd-banner" style="display:none"><span class="wd-bar"><span id="wd-banner-txt">数据面看门狗未运行（防止假连接/断线无人重拨）</span><button class="btn" id="btn-wd-on-banner">立即启用</button></span></div>
  <div class="warn-banner" id="sig-banner" style="display:none"></div>
  <div class="cards">
    <div class="kpi"><div class="lbl">连接状态</div><div class="val" id="kpi-state">—</div><div class="sub" id="kpi-state-sub">—</div></div>
    <div class="kpi"><div class="lbl">信号质量</div><div class="val" id="kpi-sig">—</div><div class="sub" id="kpi-sig-sub">—</div></div>
    <div class="kpi"><div class="lbl">实时速率</div><div class="val" id="kpi-rate">—</div><div class="sub">下行+上行（均值）</div></div>
    <div class="kpi"><div class="lbl">流量</div><div class="val" id="kpi-flow">—</div><div class="sub" id="kpi-flow-sub">本月累计 —</div></div>
    <div class="kpi"><div class="lbl">模块温度</div><div class="val" id="kpi-temp">—</div><div class="sub" id="kpi-temp-sub">TSENS</div></div>
  </div>
  <div class="grid2" id="dash-charts">
    <div class="panel"><h3><span class="dot"></span>速率趋势（上下行面积图 · 60s 均值）</h3><div class="chart" id="ch-rate"></div></div>
    <div class="panel"><h3><span class="dot"></span>信号趋势（RSRP / SINR）</h3><div class="chart" id="ch-sig"></div></div>
    <div class="panel"><h3><span class="dot"></span>模组温度（今日采样）</h3><div class="chart" id="ch-temp"></div></div>
    <div class="panel"><h3><span class="dot"></span>近 7 日流量（每日下行/上行 · 今日为真值）</h3><div class="chart" id="ch-flow7"></div></div>
    <div class="panel"><h3><span class="dot"></span>宿主机状态（OpenFi6C 实时）</h3>
      <div class="host-grid">
        <div class="host-card"><div class="host-lbl">CPU 温度</div><div class="host-val" id="host-cputemp">—</div></div>
        <div class="host-card"><div class="host-lbl">内存占用</div><div class="host-val" id="host-mem">—</div><div class="host-sub" id="host-mem-sub">—</div></div>
        <div class="host-card"><div class="host-lbl">系统负载</div><div class="host-val" id="host-load">—</div></div>
        <div class="host-card"><div class="host-lbl">活动连接</div><div class="host-val" id="host-conn">—</div></div>
        <div class="host-card"><div class="host-lbl">磁盘占用</div><div class="host-val" id="host-disk">—</div></div>
        <div class="host-card"><div class="host-lbl">运行时长</div><div class="host-val" id="host-up">—</div></div>
        <div class="host-card"><div class="host-lbl">风扇转速</div><div class="host-val" id="host-fan">—</div></div>
        <div class="host-card"><div class="host-lbl">无线温度</div><div class="host-val" id="host-wtemp">—</div></div>
      </div>
    </div>
    <div class="panel"><h3><span class="dot"></span>网络实时（宿主机吞吐 / 连接）</h3>
      <div class="host-grid">
        <div class="host-card"><div class="host-lbl">WAN 下行</div><div class="host-val" id="net-wan-rx">—</div></div>
        <div class="host-card"><div class="host-lbl">WAN 上行</div><div class="host-val" id="net-wan-tx">—</div></div>
        <div class="host-card"><div class="host-lbl">LAN 下行</div><div class="host-val" id="net-lan-rx">—</div></div>
        <div class="host-card"><div class="host-lbl">LAN 上行</div><div class="host-val" id="net-lan-tx">—</div></div>
        <div class="host-card"><div class="host-lbl">无线客户端</div><div class="host-val" id="net-wifi">—</div></div>
        <div class="host-card"><div class="host-lbl">DHCP 租约</div><div class="host-val" id="net-dhcp">—</div></div>
      </div>
    </div>
  </div>
</section>

<!-- ===== 视图：网络状态 ===== -->
<section class="page" id="page-network-status">
  <div class="grid2">
    <div class="panel">
      <h3><span class="dot"></span>信号板</h3>
      <div class="bar-wrap"><div class="bar-top"><span>信号强度</span><span class="b-v" id="sig-bar0-v">—</span></div><div class="bar"><i id="sig-bar0-i" style="width:0"></i></div></div>
      <div class="bar-wrap"><div class="bar-top"><span>5G RSRP</span><span class="b-v" id="sig-bar1-v">—</span></div><div class="bar"><i id="sig-bar1-i" style="width:0"></i></div></div>
      <div class="bar-wrap"><div class="bar-top"><span>5G SINR</span><span class="b-v" id="sig-bar2-v">—</span></div><div class="bar"><i id="sig-bar2-i" style="width:0"></i></div></div>
      <div class="bar-wrap"><div class="bar-top"><span>5G RSRQ</span><span class="b-v" id="sig-bar3-v">—</span></div><div class="bar"><i id="sig-bar3-i" style="width:0"></i></div></div>
      <div style="font-size:12px;color:var(--sub);margin-top:8px" id="sig-today">今日统计加载中…</div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>网络参数</h3>
      <div class="kv">
        <div class="it"><span class="k">网络类型</span><span class="v" id="net-type">—</span></div>
        <div class="it"><span class="k">运营商</span><span class="v" id="net-op">—</span></div>
        <div class="it"><span class="k">注册状态</span><span class="v" id="net-reg">—</span></div>
        <div class="it"><span class="k">接入技术</span><span class="v" id="net-tech">—</span></div>
        <div class="it"><span class="k">数据连接</span><span class="v" id="net-packet">—</span></div>
        <div class="it"><span class="k">数据面接口</span><span class="v" id="net-iface">—</span></div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>载波聚合 / 小区</h3>
      <div class="kv">
        <div class="it"><span class="k">载波聚合</span><span class="v" id="net-ca">—</span></div>
        <div class="it"><span class="k">5G 频段</span><span class="v" id="net-bands5g">—</span></div>
        <div class="it"><span class="k">LTE 锚点</span><span class="v" id="net-lte">—</span></div>
        <div class="it"><span class="k">PCI / 频点</span><span class="v">模块未上报明细</span></div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>数据面</h3>
      <div class="kv">
        <div class="it"><span class="k">数据面接口</span><span class="v" id="net-iface2">—</span></div>
        <div class="it"><span class="k">IPv4</span><span class="v mono" id="net-ipv4">—</span></div>
        <div class="it"><span class="k">IPv6</span><span class="v mono" id="net-ipv6">—</span></div>
        <div class="it"><span class="k">实时速率</span><span class="v" id="net-rate">—</span></div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>网络质量（PING 时延）</h3>
      <div class="kv">
        <div class="it"><span class="k">PING 网关</span><span class="v" id="net-ping-gw">未测试</span></div>
        <div class="it"><span class="k">PING DNS 223.5.5.5</span><span class="v" id="net-ping-dns">未测试</span></div>
        <div class="it"><span class="k">抖动</span><span class="v" id="net-jitter">—</span></div>
        <div class="it"><span class="k">丢包率</span><span class="v" id="net-loss">—</span></div>
        <div class="it"><span class="k">一键测试</span><span class="v" id="net-ping-ctl"><button class="btn" id="btn-ping-now" style="padding:2px 12px;font-size:12px">Ping 测试</button></span></div>
        <div class="it"><span class="k">上次体检</span><span class="v" id="net-hc">—</span></div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>基本信息</h3>
      <div class="kv">
        <div class="it"><span class="k">厂商</span><span class="v" id="net-mfg">—</span></div>
        <div class="it"><span class="k">型号</span><span class="v" id="net-model">—</span></div>
        <div class="it"><span class="k">固件版本</span><span class="v" id="net-fw">—</span></div>
        <div class="it"><span class="k">IMEI</span><span class="v mono" id="net-imei">—</span></div>
        <div class="it"><span class="k">ICCID</span><span class="v mono" id="net-iccid">—</span></div>
        <div class="it"><span class="k">IMSI</span><span class="v mono" id="net-imsi">—</span></div>
        <div class="it"><span class="k">模块温度</span><span class="v" id="net-temp">—</span></div>
        <div class="it"><span class="k">适配层</span><span class="v" id="net-adapter">—</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ===== 视图：网络配置 ===== -->
<section class="page" id="page-network-config">
  <div class="grid2">
    <div class="panel">
      <h3><span class="dot"></span>拨号设置（APN）</h3>
      <div class="row" style="margin-bottom:10px">
        <input class="input" id="apn-input" style="max-width:200px" placeholder="APN，如 cmnet">
        <input class="input" id="user-input" style="max-width:120px" placeholder="用户名（可选）">
        <input class="input" id="pass-input" style="max-width:120px" type="password" placeholder="密码（可选）">
      </div>
      <div class="row" style="margin-bottom:10px">
        <select class="input" id="apn-preset" style="max-width:220px">
          <option value="">— 运营商预设 —</option>
          <option value="cmnet">中国移动 cmnet</option>
          <option value="cmwap">中国移动 cmwap</option>
          <option value="ctnet">中国电信 ctnet</option>
          <option value="3gnet">中国联通 3gnet</option>
        </select>
        <button class="btn" id="btn-saveapn">保存并重拨</button>
      </div>
      <div class="kv" style="margin-top:6px">
        <div class="it"><span class="k">当前 APN</span><span class="v" id="cfg-apn-cur">—</span></div>
        <div class="it"><span class="k">拨号通道</span><span class="v" id="cfg-proto">—</span></div>
        <div class="it"><span class="k">数据面接口</span><span class="v" id="cfg-iface">—</span></div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>制式选择</h3>
      <div class="seg" id="mode-seg">
        <span class="seg-it" data-mode="auto">自动（5G 优先）</span>
        <span class="seg-it" data-mode="5g">仅 5G</span>
        <span class="seg-it" data-mode="4g">仅 4G</span>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--sub)" id="cfg-mode-cur">当前制式：—</div>
      <div class="row" style="margin-top:10px"><button class="btn" id="btn-mode">应用制式</button></div>
      <div style="margin-top:8px;font-size:12px;color:var(--warn)">⚠ 制式切换会重新注册网络（短暂断网）；对部分模组属于写操作，执行前需确认。</div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>频段锁定（5G）</h3>
      <div style="font-size:12px;color:var(--sub)" id="cfg-bands-cur">当前启用频段加载中…</div>
      <div style="font-size:12px;color:var(--sub);margin-top:6px">5G 频段（可多选，点击切换）</div>
      <div class="chips" id="chips-5g"></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="btn-bands">应用频段</button><button class="btn ghost" id="btn-bands-reset">恢复默认</button></div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>小区锁定（Cell Lock）</h3>
      <div class="row">
        <input class="input" id="cell-pci" style="max-width:120px" placeholder="PCI" value="">
        <input class="input" id="cell-arfcn" style="max-width:140px" placeholder="频点(ARFCN)" value="">
        <button class="btn" id="btn-celllock" disabled>锁定小区</button>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--sub)" id="cell-state">当前状态：<span class="badge b">未锁定（自动选网）</span></div>
      <div class="row" style="margin-top:10px"><button class="btn ghost" id="btn-cellunlock" disabled>关闭锁定</button></div>
      <div style="margin-top:10px;font-size:12px;color:var(--warn)" id="cell-note">小区锁定为写操作（可能短暂失联），后端暂未开放；视模组支持情况后续提供。</div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>邻区扫描（邻小区质量评估）</h3>
      <table>
        <thead><tr><th>PCI</th><th>运营商</th><th>制式/频点</th><th>状态</th></tr></thead>
        <tbody id="scan-body"><tr><td colspan="4" style="color:var(--sub)">尚未扫描</td></tr></tbody>
      </table>
      <div class="row" style="margin-top:12px"><button class="btn" id="btn-scan">重新扫描</button><span style="font-size:12px;color:var(--sub)" id="scan-hint">扫描约 60-90 秒，期间网络可能短暂断开</span></div>
    </div>
  </div>
</section>

<!-- ===== 视图：短信中心 ===== -->
<section class="page" id="page-sms">
  <div class="grid2">
    <div class="panel">
      <h3><span class="dot"></span>发送短信</h3>
      <div class="row" style="margin-bottom:10px"><input class="input" id="sms-num" style="max-width:200px" placeholder="收件号码"><span style="font-size:12px;color:var(--sub)" id="sms-count">存储 0/50</span></div>
      <textarea class="input" id="sms-text" rows="4" placeholder="短信内容" style="resize:vertical"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn" id="btn-sendsms">发送</button><span style="font-size:12px;color:var(--sub)">提示：收发短信需切换 4G，发送后自动恢复原制式</span></div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>短信列表</h3>
      <div class="sms-tabs"><span class="sms-tab on" id="tab-in">收件箱</span><span class="sms-tab" id="tab-out">已发送</span></div>
      <div id="sms-list"><div style="color:var(--sub);font-size:13px">加载中…</div></div>
      <div class="row" style="margin-top:10px"><button class="btn ghost" id="btn-reloadsms">刷新列表</button></div>
    </div>
  </div>
</section>
<!-- 短信详情弹窗 -->
<div class="modal-mask" id="sms-modal">
  <div class="modal">
    <div class="modal-h"><b id="sms-m-title">短信详情</b><span class="modal-x" id="sms-m-close">×</span></div>
    <div id="sms-m-body"></div>
    <div class="row" style="margin-top:12px">
      <button class="btn" id="sms-m-reply">回复</button>
      <button class="btn danger" id="sms-m-del">删除</button>
      <button class="btn ghost" id="sms-m-ok">关闭</button>
    </div>
  </div>
</div>

<!-- ===== 视图：AT 调试 ===== -->
<section class="page" id="page-atdebug">
  <div class="panel">
    <h3><span class="dot"></span>AT 命令终端（适配层通道，预设只读指令）</h3>
    <div class="at-short" id="at-short"></div>
    <div class="row" style="margin:10px 0">
      <input class="input" id="at-input" placeholder="输入 AT 命令，如 ATI" style="font-family:Consolas,Menlo,monospace;max-width:420px">
      <button class="btn" id="btn-at-send">发送</button>
      <button class="btn ghost" id="btn-at-clear">清空</button>
    </div>
    <div class="term" id="at-out">连接 AT 服务（适配层通道）…</div>
  </div>
</section>

<!-- ===== 视图：系统设置 ===== -->
<section class="page" id="page-system">
  <div class="grid2">
    <div class="panel">
      <h3><span class="dot"></span>数据面看门狗</h3>
      <div class="kv">
        <div class="it"><span class="k">运行状态</span><span class="v" id="wd-state">—</span></div>
        <div class="it"><span class="k">最近事件</span><span class="v" id="wd-events">—</span></div>
      </div>
      <div id="wd-timeline" style="margin-top:8px;max-height:220px;overflow:auto"></div>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="btn-wd-on">启用</button>
        <button class="btn ghost" id="btn-wd-off">停用</button>
      </div>
      <div style="font-size:12px;color:var(--sub);margin-top:8px">防止假连接/断线无人重拨。启用会写入 rc.local 开机自启。</div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>网络体检（一键诊断）</h3>
      <div class="row"><button class="btn" id="btn-hc">开始体检</button><span id="hc-status" style="font-size:12px;color:var(--sub)">上次体检：—</span></div>
      <table style="margin-top:10px">
        <thead><tr><th>检查项</th><th>结果</th></tr></thead>
        <tbody id="hc-body"><tr><td colspan="2" style="color:var(--sub)">点击"开始体检"执行（约 15 秒）</td></tr></tbody>
      </table>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>LED 状态联动</h3>
      <div class="row">
        <label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer">
          <span class="switch"><input type="checkbox" id="led-chk"><i></i></span>
          已连接时点亮
        </label>
        <select class="input" id="led-sel" style="max-width:160px"></select>
        <span style="font-size:12px;color:var(--sub)" id="led-hint">已关闭</span>
      </div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>端口转发与防火墙（只读）</h3>
      <table>
        <thead><tr><th>协议</th><th>公网端口</th><th>内网目标</th></tr></thead>
        <tbody id="nf-body"><tr><td colspan="3" style="color:var(--sub)">读取中…</td></tr></tbody>
      </table>
      <div style="font-size:12px;color:var(--sub);margin-top:10px" id="fw-line">—</div>
    </div>
    <div class="panel">
      <h3><span class="dot"></span>刷新设置</h3>
      <div class="row">
        <span style="font-size:13px">自动刷新</span>
        <label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer">
          <span class="switch"><input type="checkbox" id="ar-chk" checked><i></i></span>
          启用
        </label>
        <select class="input" style="max-width:120px" id="rate-sel">
          <option value="10" selected>10 秒（推荐）</option>
          <option value="30">30 秒</option>
          <option value="60">60 秒</option>
        </select>
      </div>
      <div style="font-size:12px;color:var(--sub);margin-top:8px">局部更新，走 ModemManager 零压力</div>
    </div>
    <div class="panel" style="grid-column:1/-1">
      <h3><span class="dot"></span>设备控制（危险操作）</h3>
      <div class="danger-zone">
        <div class="dz-title">以下操作会中断 5G 连接，请谨慎</div>
        <div class="row">
          <button class="btn danger" id="btn-reset">重启模块</button>
          <button class="btn danger" id="btn-disable">禁用模块</button>
          <button class="btn danger" id="btn-enable">启用模块</button>
          <button class="btn ghost" id="btn-redial">重拨数据面</button>
        </div>
      </div>
    </div>
  </div>
</section>

</main>
<div class="toast" id="toast"></div>


</div>`;

return view.extend({
	render: function() {
		var w = document.createElement('div');
		w.innerHTML = HTML_STR;
		var root = w.firstElementChild;
		setTimeout(function() { initApp(); }, 0);
		return root;
	}
});

function loadEcharts() {
	return new Promise(function(resolve) {
		if (typeof window.echarts !== 'undefined') return resolve();
		var s = document.createElement('script');
		s.src = '/luci-static/modem5g/echarts.min.js';
		s.onload = function() { resolve(); };
		s.onerror = function() { resolve(); };
		document.head.appendChild(s);
	});
}

function initApp() {
	var _cbi = document.querySelector('.cbi-page-actions');
	if (_cbi) _cbi.style.display = 'none';
/* 5G 模组管理 · B 方案前端逻辑（mock 内嵌 + /ubus 实时双模式） */
'use strict';
var $=function(id){return document.getElementById(id)};
/* ===== 状态映射 ===== */
var ST={connected:'已连接',registered:'已注册',searching:'搜索中',denied:'拒绝',unknown:'未知',disabled:'已禁用'};
var TC={lte:'4G LTE',nr5g:'5G NR','nr5g-sa':'5G 独立组网','nr5g-nsa':'5G 非独立组网',umts:'3G',gsm:'2G'};
var RF={registered:'归属网络',home:'归属网络',roaming:'漫游',searching:'搜索中',denied:'拒绝',unknown:'未知'};
var PK={attached:'已附着',detached:'未附着',unknown:'未知'};
function cn(map,v){return v?((map&&map[v])||v):'—'}
function fmtB(v){if(v==null||isNaN(v))return'—';v=+v;if(v>=1073741824)return(v/1073741824).toFixed(2)+' GB';if(v>=1048576)return(v/1048576).toFixed(1)+' MB';if(v>=1024)return Math.round(v/1024)+' KB';return v+' B'}
function maskId(v){if(!v)return'—';v=String(v);if(v.length<=6)return v;return v.slice(0,4)+'****'+v.slice(-3)}
function fmtTime(ts){var d=new Date(ts*1000);return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2)}
function fmtHM(ts){var d=new Date(ts*1000);return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function fmtBand(b){return String(b).replace(/^ngran-/,'n').replace(/^eutran-/,'B')}
function toBandsKey(b){b=String(b);if(/^n\d/i.test(b))return'ngran-'+b.slice(1);if(/^B\d/i.test(b))return'eutran-'+b.slice(1);return b}

/* ===== 数据层 ===== */
var R = {
  web_bundle: rpc.declare({object:'modem5g_extra', method:'web_bundle', params:{}}),
  sms_list:   rpc.declare({object:'modem5g', method:'sms_list', params:{}}),
  sms_send:   rpc.declare({object:'modem5g', method:'sms_send', params:{number:'', text:''}}),
  at_cmd:     rpc.declare({object:'modem5g', method:'at_cmd', params:{cmd:''}}),
  set_apn:    rpc.declare({object:'modem5g', method:'set_apn', params:{apn:'', user:'', password:''}}),
  set_mode:   rpc.declare({object:'modem5g', method:'set_mode', params:{allowed:'', preferred:''}}),
  set_bands:  rpc.declare({object:'modem5g', method:'set_bands', params:{bands:''}}),
  scan:       rpc.declare({object:'modem5g', method:'scan', params:{}}),
  watchdog_set: rpc.declare({object:'modem5g', method:'watchdog_set', params:{action:''}}),
  health_check: rpc.declare({object:'modem5g', method:'health_check', params:{}}),
  led_map:    rpc.declare({object:'modem5g', method:'led_map', params:{led:'', enabled:''}}),
  ping_test:  rpc.declare({object:'modem5g', method:'ping_test', params:{host:''}}),
  reset:      rpc.declare({object:'modem5g', method:'reset', params:{}}),
  disable:    rpc.declare({object:'modem5g', method:'disable', params:{}}),
  enable:     rpc.declare({object:'modem5g', method:'enable', params:{}}),
  redial:     rpc.declare({object:'modem5g', method:'redial', params:{}})
};
function ubus(obj, method, params) {
  var fn = R[method];
  if (!fn) return Promise.resolve({ error: '未声明的方法: ' + method });
  return fn(params || {});
}

/* ===== Mock 数据（T99W368 真机采样 + 模拟时段） ===== */
var _now=Math.floor(Date.now()/1000);
var _tr=(function(){var ts=[],rp=[],sn=[],te=[],ra=[];for(var i=119;i>=0;i--){var t=_now-i*60;ts.push(t);rp.push(+( -85.5+5*Math.sin((119-i)/12)).toFixed(1));sn.push(+(19+2.5*Math.sin((119-i)/9+1)).toFixed(1));te.push(+(38+1.2*Math.sin((119-i)/7)).toFixed(1));ra.push(+(Math.max(0,0.9+0.6*Math.sin((119-i)/6))).toFixed(2));}return{ts:ts,rsrp:rp,snr:sn,tsens:te,rate:ra}})();
var mock={
  ok:true,ts:_now,mm_ok:true,modem_index:'0',state:'connected',access_tech:'nr5g-sa',signal:48,
  rsrp:'-85.00',snr:'19',rsrq:'-10.5',speed_mbps:0.0,today_bytes:69632,today_rx:45056,today_tx:24576,
  month_bytes:184320,temp:'38',operator:'中国移动',operator_id:'46000',registration:'registered',packet_state:'attached',
  ifname:'wwan0',ipv4:'10.51.9.52',ipv6:'2409:8962:3c0:93b:2012:e6da:b99d:38ab',
  manufacturer:'高通 (Qualcomm)',model:'SDXLEMUR-SD-MTP',firmware:'FDE.F0.0.1.3.DF.004 053',
  imei:'355183042151282',iccid:'8986002004035173424',imsi:'4600082004035173424',
  signal_lte_rsrp:'',signal_lte_snr:'',
  today_rsrp:{min:-95,max:-80,avg:-85.5},today_tsens:{min:37,max:40,avg:38.4},
  bands5g:['n1','n28','n41','n77','n78','n79','n258'],
  cur_bands:['ngran-1','ngran-28','ngran-41','ngran-77','ngran-78','ngran-79','ngran-258'],
  occ_bands:['n78','B1'],
  cur_allowed:'auto',cur_preferred:'5g',cfg_apn:'cmnet',
  guard:{enabled:false,threshold:'-110',cooldown:'600'},
  watchdog:{running:false,events:[{time:'02:17',type:'redial',msg:'检测到假连接，触发重拨'},{time:'02:19',type:'redial',msg:'重拨成功恢复'},{time:'08:03',type:'enable',msg:'MM 重启后启用数据面'},{time:'15:32',type:'redial',msg:'信号回落，触发重拨'}]},
  leds:{list:['led1','led2'],current:'led1',enabled:false},
  host:{cpu_temp:52.3,mem_used:183920,mem_total:492880,mem_pct:37,load1:'0.32',load5:'0.28',conntrack:'13',disk_pct:41,uptime_h:96,uptime_m:33,fan_on:1,fan_pct:75,wtemp:39,wan_rx:184320,wan_tx:51200,lan_rx:94208,lan_tx:32768,wifi_sta:0,dhcp:1},
  nf:{ok:true,nat_rules:[],fw:{INPUT:{rules:6,policy:'drop'},OUTPUT:{rules:4,policy:'accept'},FORWARD:{rules:5,policy:'drop'}},conntrack:'13',conntrack_max:'63488'},
  adapter:{adapter:'回退默认（T99W368 适配）',vendor:'foxconn',channel:'adb',proto:'mbim',temp_cmd:'AT+temp?',sig_cmd:'AT+QENG="servingcell"',bands_profile:'t99',at_port:''},
  at_options:[{cmd:'ATI',label:'ATI'},{cmd:'AT+CGSN',label:'AT+CGSN'},{cmd:'AT+CSQ',label:'AT+CSQ'},{cmd:'AT+CIMI',label:'AT+CIMI'},{cmd:'AT+COPS?',label:'AT+COPS?'},{cmd:'AT+QENG="servingcell"',label:'AT+QENG'},{cmd:'AT+CFUN?',label:'AT+CFUN?'}],
  trend:_tr,
  flow7:[
    {day:'2026-09-04',rx:53248,tx:25600,total:78848},{day:'2026-09-05',rx:62464,tx:30720,total:93184},
    {day:'2026-09-06',rx:49152,tx:22528,total:71680},{day:'2026-09-07',rx:71680,tx:34816,total:106496},
    {day:'2026-09-08',rx:56320,tx:28672,total:84992},{day:'2026-09-09',rx:45056,tx:21504,total:66560},
    {day:'2026-09-10',rx:45056,tx:24576,total:69632}],
  scan_state:'',scan_networks:[],sim:{state:'',state_cn:''}
};

var M={mode:'mock',bundle:null,charts:{},timer:null,rate:10};
var BANDS5G=['n1','n2','n3','n5','n7','n8','n12','n13','n20','n25','n28','n38','n40','n41','n66','n71','n77','n78','n79','n258','n260','n261','n28A','n77-100M','n78A','n78C','n79A','n79C','n1-50M'];
var BANDS4G=['B1','B3','B5','B8','B20','B28','B40'];

/* ===== Toast ===== */
var _toast=$('toast'),_tt;
function toast(m){_toast.textContent=m;_toast.classList.add('show');clearTimeout(_tt);_tt=setTimeout(function(){_toast.classList.remove('show')},2200)}

/* ===== 路由 ===== */
var pages=document.querySelectorAll('.page'),navs=document.querySelectorAll('.nav a');
function route(){
  var h=location.hash.replace('#/','')||'dashboard';
  if(!document.getElementById('page-'+h))h='dashboard';
  pages.forEach(function(p){p.classList.toggle('on',p.id==='page-'+h)});
  navs.forEach(function(a){a.classList.toggle('on',a.dataset.p===h)});
  if(h==='dashboard'&&M.bundle&&typeof echarts!=='undefined')requestAnimationFrame(function(){Object.keys(M.charts).forEach(function(k){if(M.charts[k])M.charts[k].resize()})});
  document.querySelector('.topbar').scrollIntoView();
}
window.addEventListener('hashchange',route);

/* ===== 渲染：KPI ===== */
function sigColor(p){p=+p;return p>=60?'var(--ok)':(p>=35?'var(--warn)':'var(--bad)')}
function renderKpi(b){
  var ok=ST[b.state]||b.state||'—';
  var stEl=$('kpi-state');stEl.textContent=ok;stEl.style.color=(b.state==='connected')?'var(--ok)':'var(--warn)';
  $('kpi-state-sub').textContent=cn(TC,b.access_tech)+' · '+(b.packet_state==='attached'?'已附着':'未附着');
  $('kpi-sig').textContent=b.signal!=null?b.signal+'%':'—';$('kpi-sig').style.color=sigColor(b.signal);
  $('kpi-sig-sub').textContent=b.rsrp?('RSRP '+b.rsrp+' dBm'):'—';
  $('kpi-rate').innerHTML=(+b.speed_mbps).toFixed(2)+'<small> Mbps</small>';
  $('kpi-flow').innerHTML=fmtB(b.today_bytes)+' <small>今日</small>';
  $('kpi-flow-sub').textContent='下 '+fmtB(b.today_rx||0)+' · 上 '+fmtB(b.today_tx||0)+' · 月 '+fmtB(b.month_bytes);
  var t=parseFloat(b.temp);var tc=t>45?'var(--bad)':(t>40?'var(--warn)':'var(--ok)');
  $('kpi-temp').innerHTML=b.temp+'<small>°C</small>';$('kpi-temp').style.color=tc;
  $('kpi-temp-sub').textContent=t>45?'偏高（TSENS）':(t>40?'略高（TSENS）':'正常（TSENS）');
  var wd=$('wd-banner');
  if(b.watchdog&&!b.watchdog.running){wd.style.display='';$('wd-banner-txt').textContent='数据面看门狗未运行（防止假连接/断线无人重拨）'}
  else{wd.style.display='none'}
  /* 信号诊断横幅 */
  var rv=parseFloat(b.rsrp),sv=parseFloat(b.snr),sb=$('sig-banner');
  if(!isNaN(rv)&&(rv<=-105||(!isNaN(sv)&&sv<3))){
    sb.style.display='';sb.style.background='#fff1f0';sb.style.borderColor='#ffccc7';sb.style.color='var(--bad)';
    sb.textContent='信号质量差（RSRP '+b.rsrp+' dBm'+(b.snr&&b.snr!=='--'?' / SINR '+b.snr+' dB':'')+'）：速率低、易断线。建议靠近窗户或调整天线方向。';
  }else if(!isNaN(rv)&&(rv<=-95||(!isNaN(sv)&&sv<10))){
    sb.style.display='';sb.style.background='';sb.style.borderColor='';sb.style.color='';
    sb.textContent='信号偏弱（RSRP '+b.rsrp+' dBm'+(b.snr&&b.snr!=='--'?' / SINR '+b.snr+' dB':'')+'）：可尝试调整天线或位置改善。';
  }else{sb.style.display='none'}
}

/* ===== 渲染：信号板 / 网络状态 ===== */
function renderNetstat(b){
  var pct=function(v,lo,hi){v=parseFloat(v);if(isNaN(v))return 0;return Math.max(2,Math.min(100,(v-lo)/(hi-lo)*100))};
  $('sig-bar0-v').textContent=b.signal!=null?b.signal+'%':'—';$('sig-bar0-v').style.color=sigColor(b.signal);
  var s0=$('sig-bar0-i');s0.style.width=pct(b.signal,0,100)+'%';s0.className=(+b.signal>=60?'g':(+b.signal>=35?'y':'r'));
  var rp=parseFloat(b.rsrp),sn=parseFloat(b.snr),rq=parseFloat(b.rsrq);
  $('sig-bar1-v').textContent=b.rsrp?b.rsrp+' dBm':'N/A';$('sig-bar1-v').style.color=rp>=-90?'var(--ok)':(rp>=-110?'var(--warn)':'var(--bad)');
  var s1=$('sig-bar1-i');s1.style.width=pct(b.rsrp,-140,-60)+'%';s1.className=rp>=-90?'g':(rp>=-110?'y':'r');
  $('sig-bar2-v').textContent=b.snr?b.snr+' dB':'N/A';$('sig-bar2-v').style.color=sn>=10?'var(--ok)':(sn>=5?'var(--warn)':'var(--bad)');
  var s2=$('sig-bar2-i');s2.style.width=pct(b.snr,0,25)+'%';s2.className=sn>=10?'g':(sn>=5?'y':'r');
  $('sig-bar3-v').textContent=rq?'N/A（未上报）':(b.rsrq+' dB');var s3=$('sig-bar3-i');s3.style.width=pct(b.rsrq,-25,0)+'%';s3.className='n';
  var tr1=(b.today_rsrp&&b.today_rsrp.min!=='--')?('今日 RSRP 均 '+b.today_rsrp.avg+'（低 '+b.today_rsrp.min+' / 高 '+b.today_rsrp.max+'）dBm'):'今日统计中…';
  var tr2=(b.today_tsens&&b.today_tsens.min!=='--')?(' · 温度均 '+b.today_tsens.avg+'°C'):'';
  $('sig-today').textContent=tr1+tr2;
  $('net-type').textContent=cn(TC,b.access_tech);
  $('net-op').textContent=(cn(null,b.operator)||'—')+(b.operator_id?' ('+b.operator_id+')':'');
  $('net-reg').textContent=cn(RF,b.registration);$('net-reg').style.color=b.registration==='registered'?'var(--ok)':'var(--warn)';
  $('net-tech').textContent=cn(TC,b.access_tech);
  $('net-packet').textContent=cn(PK,b.packet_state);$('net-packet').style.color=b.packet_state==='attached'?'var(--ok)':'var(--warn)';
  $('net-iface').textContent=b.ifname||'—';$('net-iface2').textContent=b.ifname||'—';
  $('net-ca').textContent=(b.bands5g&&b.bands5g.length>1)?('多载波聚合（'+(b.bands5g.length)+' 频段）'):((b.bands5g&&b.bands5g.length)?('单载波 '+b.bands5g[0]):'模块未上报明细');
  $('net-bands5g').textContent=(b.bands5g&&b.bands5g.length)?b.bands5g.join(', '):'—';
  $('net-lte').textContent=(b.signal_lte_rsrp)?('RSRP '+b.signal_lte_rsrp+' dBm'+(b.signal_lte_snr?' / SINR '+b.signal_lte_snr+' dB':'')):'LTE 未上报';
  $('net-ipv4').textContent=b.ipv4||'—';$('net-ipv6').textContent=b.ipv6||'—';
  $('net-rate').textContent='合计 '+(+b.speed_mbps).toFixed(2)+' Mbps（60s 均值）';
  $('net-mfg').textContent=b.manufacturer||'—';$('net-model').textContent=b.model||'—';$('net-fw').textContent=b.firmware||'—';
  $('net-imei').textContent=maskId(b.imei);$('net-iccid').textContent=maskId(b.iccid);$('net-imsi').textContent=maskId(b.imsi);
  $('net-temp').textContent=b.temp?b.temp+'°C':'—';
  $('net-adapter').textContent=b.adapter?b.adapter.adapter:'—';
  $('brand-model').textContent=(b.model||'未知模组')+' · '+(b.adapter?('适配层 '+(b.adapter.vendor||'')):'');
}

/* ===== 渲染：配置 ===== */
var _dirtyBands=false,_dirtyMode=false,_dirtyApn=false;
function markDirty(btn){btn.classList.add('dirty');btn.title='有未保存的更改'}
function clearDirty(btn){btn.classList.remove('dirty');btn.title=''}
function renderConfig(b){
  $('apn-input').value=b.cfg_apn||'';
  $('cfg-apn-cur').textContent=b.cfg_apn||'—';
  $('cfg-proto').textContent=(b.adapter&&b.adapter.proto)?(b.adapter.channel+' · '+b.adapter.proto):'—';
  $('cfg-iface').textContent=b.ifname||'—';
  var cur=b.cur_allowed||'auto';
  document.querySelectorAll('#mode-seg .seg-it').forEach(function(s){s.classList.toggle('on',s.dataset.mode===cur)});
  $('cfg-mode-cur').textContent='当前制式：'+(cur==='auto'?'自动（5G 优先）':(cur==='5g'?'仅 5G':'仅 4G'))+'（优先 '+b.cur_preferred+'）';
  // 频段 chips
  var curOn={}; (b.cur_bands||[]).forEach(function(x){curOn[fmtBand(x)]=1});
  var c5=$('chips-5g');c5.innerHTML='';
  BANDS5G.forEach(function(bd){
    var s=document.createElement('span');s.className='chip'+(curOn[bd]?' on':'');s.textContent=bd;
    s.addEventListener('click',function(){s.classList.toggle('on');_dirtyBands=true;markDirty($('btn-bands'))});
    c5.appendChild(s);
  });
  $('cfg-bands-cur').textContent='当前启用 '+(b.cur_bands||[]).length+' 个频段：'+(b.cur_bands||[]).slice(0,12).map(fmtBand).join(', ')+((b.cur_bands||[]).length>12?' 等':'');
  // AT 快捷
  var as=$('at-short');as.innerHTML='';
  (b.at_options||[]).forEach(function(o){
    var bt=document.createElement('button');bt.textContent=o.label;
    bt.addEventListener('click',function(){$('at-input').value=o.cmd;$('at-input').focus()});
    as.appendChild(bt);
  });
  // LED
  var ls=$('led-sel');ls.innerHTML='';
  (b.leds&&b.leds.list||[]).forEach(function(l){var o=document.createElement('option');o.value=l;o.textContent=l;ls.appendChild(o)});
  if(b.leds&&b.leds.current)ls.value=b.leds.current;
  $('led-chk').checked=!!(b.leds&&b.leds.enabled);
  $('led-hint').textContent=(b.leds&&b.leds.enabled)?'已开启（亮=已连接）':'已关闭';
  // 看门狗
  $('wd-state').textContent=(b.watchdog&&b.watchdog.running)?'运行中':'未运行';
  $('wd-state').style.color=(b.watchdog&&b.watchdog.running)?'var(--ok)':'var(--bad)';
  $('wd-events').textContent=(b.watchdog&&b.watchdog.events&&b.watchdog.events.length)?('最近 '+b.watchdog.events.length+' 条'):'—';
  /* 断线/重拨事件时间线 */
  var evs=(b.watchdog&&b.watchdog.events)||[];
  var tl=$('wd-timeline');
  if(tl){
    if(!evs.length){tl.innerHTML='<div style="color:var(--sub);font-size:12px">暂无事件（看门狗未运行或尚无记录）</div>'}
    else{tl.innerHTML=evs.map(function(e){
      var c=e.type==='redial'?'var(--bad)':(e.type==='enable'?'var(--ok)':'var(--sub)');
      return '<div style="display:flex;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dashed #f0f1f3"><span style="color:var(--sub);white-space:nowrap">'+e.time+'</span><span style="color:'+c+'">'+e.msg+'</span></div>';
    }).join('')}
  }
  // 防火墙
  var nb=$('nf-body');nb.innerHTML='';
  var rules=(b.nf&&b.nf.nat_rules)||[];
  if(!rules.length){nb.innerHTML='<tr><td colspan="3" style="color:var(--sub)">暂无 DNAT 转发规则（未配置端口映射）</td></tr>'}
  else{rules.forEach(function(r){var tr=document.createElement('tr');tr.innerHTML='<td>'+(r.proto||'—').toUpperCase()+'</td><td>'+r.pub+'</td><td>'+r.dst+':'+r.dport+'</td>';nb.appendChild(tr)})}
  var fw=b.nf&&b.nf.fw||{};var f=function(n){var c=fw[n]||{};return n+' '+(c.rules||0)+' 条'+(c.policy?'（策略 '+c.policy+'）':'')};
  $('fw-line').textContent='防火墙链：'+f('INPUT')+' · '+f('OUTPUT')+' · '+f('FORWARD')+(b.nf&&b.nf.conntrack?(' · NAT 连接 '+b.nf.conntrack+' / '+b.nf.conntrack_max):'');
}

/* ===== 渲染：短信 ===== */
var smsState={list:[],sent:[],modal:null};
function renderSms(list){
  smsState.list=list||[];
  var box=$('sms-list');box.innerHTML='';
  if(!smsState.list.length){box.innerHTML='<div style="color:var(--sub);font-size:13px">收件箱为空</div>';$('sms-count').textContent='存储 0/50';return}
  $('sms-count').textContent='存储 '+smsState.list.length+'/50';
  smsState.list.forEach(function(s,i){
    var d=document.createElement('div');d.className='sms-item';
    var t=(s.timestamp||'').replace('T',' ').slice(0,16);
    var unread=(s.state==='received');
    d.innerHTML='<div class="h"><span>'+(unread?'<i class="badge-u"></i>':'')+(s.number||'—')+'</span><span>'+t+'</span></div><div class="clip">'+(s.text||'')+'</div>';
    d.addEventListener('click',function(){showSmsDetail(i)});
    box.appendChild(d);
  });
}
function loadSent(){
  ubus('modem5g','sms_sent',{}).then(function(r){
    smsState.sent=(r&&r.sms)||[];
    var box=$('sms-list');box.innerHTML='';
    if(!smsState.sent.length){box.innerHTML='<div style="color:var(--sub);font-size:13px">暂无已发送记录</div>';return}
    smsState.sent.forEach(function(s,i){
      var d=document.createElement('div');d.className='sms-item';
      var tt=(s.iso)||'—';
      var badge=s.ok?'<span class="badge g">已发送</span>':'<span class="badge r">失败</span>';
      d.innerHTML='<div class="h"><span>'+(s.number||'—')+'</span><span>'+tt+' '+badge+'</span></div><div class="clip">'+(s.text||'')+'</div>';
      d.addEventListener('click',function(){showSentDetail(i)});
      box.appendChild(d);
    });
  });
}
function showSmsDetail(i){
  var s=smsState.list[i];if(!s)return;
  $('sms-m-title').textContent='收件箱短信';
  $('sms-m-body').innerHTML='<div class="sms-meta">发件人：'+(s.number||'—')+'<br>时间：'+((s.timestamp||'').replace('T',' '))+'<br>状态：'+(s.state==='received'?'未读':'已读')+'</div><div class="sms-full">'+(s.text||'')+'</div>';
  $('sms-modal').classList.add('show');
  smsState.modal={type:'in',idx:i,ts:null};
}
function showSentDetail(i){
  var s=smsState.sent[i];if(!s)return;
  $('sms-m-title').textContent='已发送短信';
  $('sms-m-body').innerHTML='<div class="sms-meta">收件人：'+(s.number||'—')+'<br>时间：'+(s.iso||'—')+'<br>结果：'+(s.ok?'已发送':'发送失败')+(s.detail?'（'+(s.detail||'')+'）':'')+'</div><div class="sms-full">'+(s.text||'')+'</div>';
  $('sms-modal').classList.add('show');
  smsState.modal={type:'out',idx:i,ts:s.ts};
}
function refreshSms(){
  /* 已发送 tab 只刷新已发送，避免与收件箱渲染竞态互跳 */
  if(document.getElementById('tab-out').classList.contains('on')){loadSent();return}
  ubus('modem5g','sms_list',{}).then(function(r){
    if(r&&r.sms)renderSms(r.sms);
    else if(M.mode==='mock')renderSms([
      {timestamp:'2026-09-09T16:30',number:'10086',state:'received',text:'您的流量套餐本月剩余 1.2GB，下月 1 日重置。'},
      {timestamp:'2026-09-01T09:12',number:'10086',state:'read',text:'欢迎使用中国移动 5G 网络，祝您使用愉快。'}]);
    else renderSms(null);
  });
}

/* ===== 渲染：AT ===== */
function atOut(lines){$('at-out').textContent=lines.join('\n');$('at-out').scrollTop=$('at-out').scrollHeight}
function sendAt(cmd){
  cmd=(cmd||$('at-input').value).trim();
  if(!cmd){toast('请输入 AT 命令');return}
  $('at-input').value='';
  atOut(['> '+cmd,'执行中（适配层通道）…']);
  ubus('modem5g','at_cmd',{cmd:cmd}).then(function(r){
    if(r&&r.error)atOut(['> '+cmd,'ERROR: '+(r.error||'')]);
    else if(r)atOut(['> '+cmd, r.output||'（无输出）']);
    else atOut(['> '+cmd,'ERROR: 请求失败（未连接设备或未登录）']);
  });
}

/* ===== 渲染：系统 ===== */
function renderSystem(b){
  var hb=$('hc-body');hb.innerHTML='';
  if(M.mode==='mock'){
    hb.innerHTML='<tr><td>模块响应</td><td><span class="badge g">正常</span></td></tr>'+
      '<tr><td>SIM 卡状态</td><td><span class="badge g">已就绪</span></td></tr>'+
      '<tr><td>网络注册</td><td><span class="badge g">已注册</span></td></tr>'+
      '<tr><td>数据附着</td><td><span class="badge g">已附着</span></td></tr>'+
      '<tr><td>IP 获取</td><td><span class="badge g">'+(b.ipv4||'—')+'</span></td></tr>'+
      '<tr><td>Ping 网关</td><td><span class="badge y">演示未测</span></td></tr>';
  }else{
    hb.innerHTML='<tr><td colspan="2" style="color:var(--sub)">点击"开始体检"执行（约 15 秒）</td></tr>';
  }
}

/* ===== 图表 ===== */
function tLabels(b){var t=(b.trend&&b.trend.ts)||[];return t.map(fmtHM)}
function ech(id,opt){var el=$(id);if(!el)return null;var c=M.charts[id];if(!c){c=echarts.getInstanceByDom(el)||echarts.init(el,null,{renderer:'canvas'});M.charts[id]=c}c.setOption(opt);return c}
function drawCharts(b){
  if(typeof echarts==='undefined')return;
  var labels=tLabels(b);
  var every=Math.max(1,Math.floor(labels.length/12));
  var xl=labels.map(function(v,i){return i%every===0?v:''});
  var t=b.trend||{};
  var rate=t.rate||[],flow7=b.flow7||[],trp=b.today_rx||0,ttp=b.today_tx||0;
  var days=flow7.map(function(d){return String(d.day).slice(5)});
  ech('ch-rate',{tooltip:{trigger:'axis'},legend:{data:['实时速率'],top:0},grid:{left:46,right:14,top:32,bottom:28},
    xAxis:{type:'category',data:xl,axisLabel:{fontSize:10}},yAxis:{type:'value',name:'Mbps',axisLabel:{fontSize:10}},
    series:[{name:'实时速率',type:'line',smooth:true,data:rate,lineStyle:{width:2,color:'#1677ff'},areaStyle:{opacity:.18},itemStyle:{color:'#1677ff'}}]});
  ech('ch-sig',{tooltip:{trigger:'axis'},legend:{data:['RSRP','SINR'],top:0},grid:{left:46,right:14,top:32,bottom:28},
    xAxis:{type:'category',data:xl,axisLabel:{fontSize:10}},
    yAxis:[{type:'value',name:'dBm',axisLabel:{fontSize:10}},{type:'value',name:'dB',axisLabel:{fontSize:10}}],
    series:[{name:'RSRP',type:'line',smooth:true,data:t.rsrp||[],lineStyle:{width:2},itemStyle:{color:'#e67e22'}},
            {name:'SINR',type:'line',smooth:true,yAxisIndex:1,data:t.snr||[],lineStyle:{width:2},itemStyle:{color:'#1677ff'}}]});
  ech('ch-temp',{tooltip:{trigger:'axis'},grid:{left:52,right:14,top:24,bottom:28},
    xAxis:{type:'category',data:xl,axisLabel:{fontSize:10}},yAxis:{type:'value',min:30,max:50,axisLabel:{fontSize:10,formatter:function(v){return v+'°C'}}},
    series:[{name:'TSENS',type:'line',smooth:true,data:t.tsens||[],lineStyle:{width:2,color:'#fa8c16'},
      areaStyle:{opacity:.15},itemStyle:{color:'#fa8c16'}}]});
  var fmax=0;flow7.forEach(function(d){if(d.rx>fmax)fmax=d.rx;if(d.tx>fmax)fmax=d.tx});
  var yunit=fmax>=1073741824?'GB':(fmax>=1048576?'MB':'KB');
  var ydiv=fmax>=1073741824?1073741824:(fmax>=1048576?1048576:1024);
  ech('ch-flow7',{tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){var r=ps[0].axisValue+'<br/>';ps.forEach(function(p){r+=p.marker+p.seriesName+'：'+fmtB(p.value)+'<br/>'});return r}},legend:{data:['下行','上行'],top:0},grid:{left:46,right:14,top:32,bottom:28},
    xAxis:{type:'category',data:days,axisLabel:{fontSize:10}},yAxis:{type:'value',name:yunit,axisLabel:{fontSize:10,formatter:function(v){return (v/ydiv).toFixed(0)}}},
    series:[{name:'下行',type:'bar',data:flow7.map(function(d){return d.rx}),barWidth:10,itemStyle:{color:'#1677ff',borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:9,formatter:function(p){return fmtB(p.value).replace(' ','')}}},
            {name:'上行',type:'bar',data:flow7.map(function(d){return d.tx}),barWidth:10,itemStyle:{color:'#52c41a',borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:9,formatter:function(p){return fmtB(p.value).replace(' ','')}}}]});
}

/* ===== 渲染：宿主机实时状态 ===== */
function fmtMem(k){k=+k||0;if(k>=1048576)return(k/1048576).toFixed(1)+'G';if(k>=1024)return Math.round(k/1024)+'M';return k+'K'}
function renderHost(h){
  h=h||{};
  var ct=parseFloat(h.cpu_temp),el=$('host-cputemp');
  if(h.cpu_temp!=='--'&&h.cpu_temp!=null){el.innerHTML=Math.round(h.cpu_temp*10)/10+'<small>°C</small>';el.style.color=!isNaN(ct)?(ct>75?'var(--bad)':(ct>65?'var(--warn)':'var(--ok)')):''}
  else el.innerHTML='—';
  var m=$('host-mem');
  if(h.mem_pct!=null){m.innerHTML=h.mem_pct+'<small>%</small>';m.style.color=h.mem_pct>85?'var(--bad)':(h.mem_pct>70?'var(--warn)':'var(--ok)')}else m.innerHTML='—';
  $('host-mem-sub').textContent=(h.mem_used!=null&&h.mem_total)?(fmtMem(h.mem_used)+' / '+fmtMem(h.mem_total)):'—';
  $('host-load').innerHTML=(h.load1!=null)?(h.load1+'<small>/'+h.load5+'</small>'):'—';
  $('host-conn').textContent=(h.conntrack!=null&&h.conntrack!=='')?h.conntrack:'—';
  var d=$('host-disk');
  if(h.disk_pct!=null){d.innerHTML=h.disk_pct+'<small>%</small>';d.style.color=h.disk_pct>85?'var(--bad)':(h.disk_pct>70?'var(--warn)':'var(--ok)')}else d.innerHTML='—';
  $('host-up').textContent=(h.uptime_h!=null)?(h.uptime_h+'h '+h.uptime_m+'m'):'—';
  /* 风扇转速（反极性 PWM：duty 越小越快；档位 50/75/100%） */
  var fe=$('host-fan');
  if(h.fan_on==1&&h.fan_pct!=null){fe.innerHTML=h.fan_pct+'<small>%</small>';fe.style.color=h.fan_pct>=100?'var(--bad)':(h.fan_pct>=75?'var(--warn)':'var(--ok)')}
  else if(h.fan_pct!=null){fe.innerHTML='0<small>%</small>'}else fe.innerHTML='—';
  /* 无线芯片温度（mt7915 phy 取高） */
  var wt=h.wtemp;
  var we=$('host-wtemp');
  if(wt!=null){we.innerHTML=wt+'<small>°C</small>';we.style.color=wt>95?'var(--bad)':(wt>80?'var(--warn)':'var(--ok)')}else we.innerHTML='—';
}

/* ===== 渲染：网络实时（宿主机吞吐/连接） ===== */
function renderNet(h){
  h=h||{};
  function rate(el,v){el.innerHTML=(v!=null&&v!==0)?fmtB(v)+'<small>/s</small>':'0<small>B/s</small>'}
  rate($('net-wan-rx'),h.wan_rx);rate($('net-wan-tx'),h.wan_tx);
  rate($('net-lan-rx'),h.lan_rx);rate($('net-lan-tx'),h.lan_tx);
  var w=$('net-wifi');w.innerHTML=(h.wifi_sta!=null)?(h.wifi_sta+'<small> 台</small>'):'—';
  var d=$('net-dhcp');d.innerHTML=(h.dhcp!=null)?(h.dhcp+'<small> 个</small>'):'—';
}

/* ===== 全页渲染 ===== */
function renderAll(b){
  renderKpi(b);renderNetstat(b);renderConfig(b);renderSystem(b);renderHost(b.host);renderNet(b.host);
  if(document.getElementById('page-dashboard').classList.contains('on'))drawCharts(b);
  else drawCharts(b);
}
function updateAll(b){
  renderKpi(b);renderNetstat(b);renderHost(b.host);renderNet(b.host);
  drawCharts(b);
}

/* ===== 加载与刷新 ===== */
function loadBundle(){
  return ubus('modem5g_extra','web_bundle',{}).then(function(r){
    if(r&&r.ok&&!r.error){M.bundle=r;M.mode='api';return r}return null;
  });
}
function loadAll(){
  return loadBundle().then(function(b){
    if(!b){M.bundle=mock;M.mode='mock'}
    var tag=$('mode-tag');
    if(M.mode==='api'){tag.textContent='实时模式 · 更新于 '+fmtTime(M.bundle.ts);tag.className='demo-tag api'}
    else{tag.textContent='演示模式（未登录或设备不可达）';tag.className='demo-tag'}
    renderAll(M.bundle);
    if(M.mode==='api')refreshSms();
    return M.bundle;
  }).catch(function(e){
    M.bundle=mock;M.mode='mock';
    var tag=$('mode-tag');tag.textContent='演示模式（会话失效或设备不可达）';tag.className='demo-tag';
    renderAll(M.bundle);
    return M.bundle;
  });
}
function startAr(){
  if(M.timer)clearInterval(M.timer);
  M.timer=setInterval(function(){
    if(!$('ar-chk').checked)return;
    loadBundle().then(function(b){
      if(b){M.bundle=b;updateAll(b);
        if(document.getElementById('page-sms').classList.contains('on'))refreshSms();
        var tag=$('mode-tag');tag.textContent='实时模式 · 更新于 '+fmtTime(b.ts);tag.className='demo-tag api';
      }
    }).catch(function(e){
      var tag=$('mode-tag');tag.className='demo-tag';
      tag.textContent=M.bundle&&M.bundle.ts?('刷新失败 · 最后更新 '+fmtTime(M.bundle.ts)):'刷新失败（会话失效或设备不可达）';
    });
  },M.rate*1000);
}

/* ===== 交互绑定 ===== */
function bindClick(id,fn){var el=$(id);if(el)el.addEventListener('click',fn)}
function dangerConfirm(name,effect,fn){
  if(!confirm('确认执行「'+name+'」？\n'+effect+'。\n此操作不可逆，请确认。'))return;
  if(!confirm('再次确认：'+name+' 将中断 5G 数据面。\n'+effect+'。\n如无把握请取消。'))return;
  fn();
}
/* APN */
['apn-input','user-input','pass-input'].forEach(function(id){$(id).addEventListener('input',function(){_dirtyApn=true;markDirty($('btn-saveapn'))})});
$('apn-preset').addEventListener('change',function(){var v=this.value;if(v){$('apn-input').value=v;_dirtyApn=true;markDirty($('btn-saveapn'))}});
bindClick('btn-saveapn',function(){
  var apn=$('apn-input').value.trim(),u=$('user-input').value.trim(),p=$('pass-input').value.trim();
  if(!apn){toast('请输入 APN');return}
  if(!confirm('保存 APN「'+apn+'」并重拨数据面？\n网络将短暂断开（约 10-30 秒）。'))return;
  ubus('modem5g','set_apn',{apn:apn,user:u,password:p}).then(function(r){
    toast(r&&r.ok?('✅ '+(r.detail||'已保存')):'❌ '+((r&&r.error)||(r&&r.detail)||'设置失败'));clearDirty($('btn-saveapn'));
  });
});
/* 制式 */
document.querySelectorAll('#mode-seg .seg-it').forEach(function(s){
  s.addEventListener('click',function(){
    document.querySelectorAll('#mode-seg .seg-it').forEach(function(x){x.classList.remove('on')});
    s.classList.add('on');_dirtyMode=true;markDirty($('btn-mode'));
  });
});
bindClick('btn-mode',function(){
  var sel=document.querySelector('#mode-seg .seg-it.on');if(!sel)return;
  var mode=sel.dataset.mode;
  dangerConfirm('切换制式为「'+sel.textContent+'」','模块将重新注册网络（约 1 分钟断网）',function(){
    ubus('modem5g','set_mode',{allowed:mode,preferred:''}).then(function(r){
      toast(r&&r.ok?('✅ '+(r.detail||'已应用')):'❌ '+((r&&r.error)||(r&&r.detail)||'失败'));clearDirty($('btn-mode'));
    });
  });
});
/* 频段 */
bindClick('btn-bands',function(){
  var on=[];document.querySelectorAll('#chips-5g .chip.on').forEach(function(s){on.push(toBandsKey(s.textContent))});
  if(!on.length){toast('请至少选择一个频段，或点"恢复默认"') ;return}
  dangerConfirm('应用 '+on.length+' 个频段','错误锁频可能影响信号或注册（可随时恢复默认）',function(){
    ubus('modem5g','set_bands',{bands:on.join('|')}).then(function(r){
      toast(r&&r.ok?('✅ '+(r.detail||'已应用')):'❌ '+((r&&r.error)||'设置失败'));clearDirty($('btn-bands'));
    });
  });
});
bindClick('btn-bands-reset',function(){
  dangerConfirm('恢复默认频段','取消全部频段锁定，恢复自动选频',function(){
    ubus('modem5g','set_bands',{bands:'any'}).then(function(r){
      toast(r&&r.ok?'✅ 已恢复默认频段':'❌ '+((r&&r.error)||'失败'));
    });
  });
});
/* 扫描 */
bindClick('btn-scan',function(){
  var btn=$('btn-scan');btn.disabled=true;$('scan-hint').textContent='扫描中（约 60-90 秒），网络可能短暂断开…';
  ubus('modem5g','scan',{}).then(function(r){
    btn.disabled=false;
    var nets=(r&&r.networks)||[];
    $('scan-hint').textContent=nets.length?('发现 '+nets.length+' 个小区'):'扫描完成（未发现可注册小区）';
    var tb=$('scan-body');tb.innerHTML='';
    if(!nets.length){tb.innerHTML='<tr><td colspan="4" style="color:var(--sub)">'+((r&&r.error)||'无扫描结果')+'</td></tr>';return}
    nets.forEach(function(n){
      var tr=document.createElement('tr');
      tr.innerHTML='<td class="num">'+(n.pci||n.ci||'—')+'</td><td>'+(n.operator||'—')+'</td><td>'+(n.tech||n.rat||'—')+' / '+(n.freq||n.arfc||'—')+'</td><td>'+(n.signal||'—')+'</td>';
      tb.appendChild(tr);
    });
  });
});
/* 短信 */
bindClick('btn-sendsms',function(){
  var num=$('sms-num').value.trim(),text=$('sms-text').value.trim();
  if(!num||!text){toast('请输入号码和内容');return}
  if(!confirm('发送短信到 '+num+'？\n收发短信需切换 4G，发送后自动恢复原制式。'))return;
  ubus('modem5g','sms_send',{number:num,text:text}).then(function(r){
    toast(r&&r.ok?('✅ '+(r.detail||'已发送')):'❌ '+((r&&r.error)||(r&&r.detail)||'发送失败'));
    if(r&&r.ok){$('sms-text').value='';refreshSms()}
  });
});
bindClick('btn-reloadsms',function(){refreshSms();toast('已刷新')});
bindClick('tab-in',function(){
  document.getElementById('tab-in').classList.add('on');document.getElementById('tab-out').classList.remove('on');
  renderSms(smsState.list);
});
bindClick('tab-out',function(){
  document.getElementById('tab-in').classList.remove('on');document.getElementById('tab-out').classList.add('on');
  $('sms-count').textContent='';loadSent();
});
bindClick('sms-m-close',function(){$('sms-modal').classList.remove('show')});
bindClick('sms-m-ok',function(){$('sms-modal').classList.remove('show')});
bindClick('sms-m-reply',function(){
  var m=smsState.modal;if(!m)return;
  var num=m.type==='in'?(smsState.list[m.idx]||{}).number:(smsState.sent[m.idx]||{}).number;
  $('sms-modal').classList.remove('show');
  if(num){$('sms-num').value=num;$('sms-text').focus();toast('号码已填入收件人，可修改后发送')}
});
bindClick('sms-m-del',function(){
  var m=smsState.modal;if(!m)return;
  $('sms-modal').classList.remove('show');
  if(m.type==='in'){
    var s=smsState.list[m.idx];if(!s)return;
    if(!confirm('删除这条短信（模块存储）？'))return;
    ubus('modem5g','sms_delete',{index:s.index}).then(function(r){toast(r&&r.ok?'✅ 已删除':'❌ '+((r&&r.error)||'删除失败'));refreshSms()});
  }else{
    var s=smsState.sent[m.idx];if(!s)return;
    if(!confirm('删除这条已发送记录？'))return;
    ubus('modem5g','sms_sent_delete',{ts:s.ts}).then(function(r){toast(r&&r.ok?'✅ 已删除':'❌ '+((r&&r.error)||'删除失败'));loadSent()});
  }
});
/* AT */
bindClick('btn-at-send',function(){sendAt()});
$('at-input').addEventListener('keydown',function(e){if(e.key==='Enter')sendAt()});
bindClick('btn-at-clear',function(){$('at-out').textContent='终端已清空'});
/* 看门狗 */
bindClick('btn-wd-on',function(){
  if(!confirm('启用数据面看门狗？\n检测到假连接/断线将自动重拨。'))return;
  ubus('modem5g','watchdog_set',{action:'start'}).then(function(r){toast(r&&r.ok?'✅ 看门狗已启用':'❌ '+((r&&r.error)||'失败'));loadBundle().then(updateAll)});
});
bindClick('btn-wd-off',function(){
  if(!confirm('停用数据面看门狗？\n断线后将不再自动重拨。'))return;
  ubus('modem5g','watchdog_set',{action:'stop'}).then(function(r){toast(r&&r.ok?'✅ 看门狗已停用':'❌ '+((r&&r.error)||'失败'));loadBundle().then(updateAll)});
});
bindClick('btn-wd-on-banner',function(){
  ubus('modem5g','watchdog_set',{action:'start'}).then(function(r){toast(r&&r.ok?'✅ 看门狗已启用':'❌ '+((r&&r.error)||'失败'));loadBundle().then(updateAll)});
});
/* 体检 */
bindClick('btn-hc',function(){
  var btn=$('btn-hc');btn.disabled=true;btn.textContent='体检中（约 15 秒）…';$('hc-status').textContent='体检中…';
  ubus('modem5g','health_check',{}).then(function(r){
    btn.disabled=false;btn.textContent='开始体检';
    var hb=$('hc-body');hb.innerHTML='';
    if(!r||r.error){hb.innerHTML='<tr><td colspan="2" style="color:var(--sub)">'+(r&&r.error||'执行失败')+'</td></tr>';$('hc-status').textContent='上次体检：失败';return}
    $('hc-status').textContent='上次体检：'+(r.summary||'完成');
    (r.items||[]).forEach(function(it){
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+it.name+'</td><td><span class="badge '+(it.ok?'g':'r')+'">'+(it.ok?'✓ 通过':'✗ 失败')+'</span> '+(it.detail||'')+'</td>';
      hb.appendChild(tr);
    });
  });
});
/* LED */
$('led-chk').addEventListener('change',function(){
  var on=this.checked?'1':'0';var sel=$('led-sel').value;
  ubus('modem5g','led_map',{led:sel,enabled:on}).then(function(r){
    if(r&&r.ok){$('led-hint').textContent=on==='1'?'已开启（亮=已连接）':'已关闭'}else{this.checked=!this.checked;toast('❌ '+((r&&r.error)||'设置失败'))}
  }.bind(this));
});
/* Ping */
bindClick('btn-ping-now',function(){
  var btn=$('btn-ping-now');btn.disabled=true;btn.textContent='测试中…';
  ubus('modem5g','ping_test',{host:'223.5.5.5'}).then(function(r){
    btn.disabled=false;btn.textContent='Ping 测试';
    if(!r||!r.ok){$('net-ping-gw').textContent='失败';$('net-ping-dns').textContent=((r&&r.error)||'—');return}
    $('net-ping-gw').textContent=r.avg+' ms';$('net-ping-dns').textContent=r.detail||('丢包 '+r.loss+'%');
    $('net-jitter').textContent='±'+((+r.max-+r.min).toFixed(0))+' ms';$('net-loss').textContent=r.loss+'%';
    toast('Ping 223.5.5.5 完成');
  });
});
/* 危险操作 */
bindClick('btn-reset',function(){
  dangerConfirm('重启模块','将中断 5G 连接约 1-3 分钟',function(){
    ubus('modem5g','reset',{}).then(function(r){toast(r&&r.ok?('✅ '+(r.detail||'已重启')):'❌ '+((r&&r.error)||'失败'))});
  });
});
bindClick('btn-disable',function(){
  dangerConfirm('禁用模块','5G 将完全断开，需手动点击"启用模块"恢复',function(){
    ubus('modem5g','disable',{}).then(function(r){toast(r&&r.ok?('✅ '+(r.detail||'已禁用')):'❌ '+((r&&r.error)||'失败'))});
  });
});
bindClick('btn-enable',function(){
  if(!confirm('启用模块？\n将重新注册网络并恢复 5G。'))return;
  ubus('modem5g','enable',{}).then(function(r){toast(r&&r.ok?('✅ '+(r.detail||'已启用')):'❌ '+((r&&r.error)||'失败'))});
});
bindClick('btn-redial',function(){
  if(!confirm('重拨数据面？\n网络将短暂断开（约 5-15 秒）。'))return;
  ubus('modem5g','redial',{}).then(function(r){toast(r&&r.ok?('✅ '+(r.detail||'已重拨')):'❌ '+((r&&r.error)||'失败'))});
});
/* 刷新设置 */
$('rate-sel').addEventListener('change',function(){
  M.rate=parseInt(this.value,10)||10;
  if($('ar-chk').checked)startAr();
  toast('自动刷新间隔已设为 '+M.rate+' 秒');
});
$('ar-chk').addEventListener('change',function(){
  if(this.checked){startAr();toast('已开启自动刷新（每 '+M.rate+' 秒）')}
  else{if(M.timer)clearInterval(M.timer);toast('已关闭自动刷新')}
});

/* ===== 启动 ===== */
loadAll().then(function(){if($('ar-chk').checked)startAr()});
route();
window.addEventListener('resize',function(){Object.keys(M.charts).forEach(function(k){if(M.charts[k])M.charts[k].resize()})});

	/* ===== 启动（echarts 就绪后） ===== */
	loadEcharts().then(start, start);
	function start() {
		loadAll().then(function() { if ($('ar-chk') && $('ar-chk').checked) startAr(); });
	}
	route();
	window.addEventListener('resize', function() {
		Object.keys(M.charts).forEach(function(k) { if (M.charts[k]) M.charts[k].resize(); });
	});
}
