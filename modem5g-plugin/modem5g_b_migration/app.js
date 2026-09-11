/* 5G 模组管理 · B 方案前端逻辑（mock 内嵌 + /ubus 实时双模式） */
(function(){
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
function getSid(){var m=document.cookie.match(/sysauth[^=]*=([0-9a-f]{32})/);return m?m[1]:null}
function ubus(obj,method,params){
  return fetch('/ubus',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:Date.now()%100000,method:'call',params:[getSid()||'00000000000000000000000000000000',obj,method,params||{}]})})
  .then(function(r){return r.json()})
  .then(function(j){if(j&&j.result&&j.result[0]===0)return j.result[1];if(j&&j.error)return{error:j.error.message||'rpc error'};return null})
  .catch(function(){return null});
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
})();
