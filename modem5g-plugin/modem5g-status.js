'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

// =====================================================================
// modem5g-status.js 重构版 v4.1（2026-09-10）
// v4.1 真机页面优化（ACL 修复后实测）：
//  V1 信号无效值（RSRP<=-140）判定为「无锚点」（不误导为差）；LTE 行注明 NSA 正常
//  V2 5G RSRQ 模块未上报时显示「N/A（未上报）」而非裸 --
//  V3 自动刷新默认开启，勾选状态 localStorage 记忆
//  V4 页面标题动态显示实际模组型号（适配多模组）
//  V5 窄屏(≤720px)三卡单栏堆叠；69 个频段 chips 默认收起到 16 个+展开按钮
//  V6 看门狗事件时间线默认最近 5 条+展开全部（折叠区不再过长）
//  V7 信号强度行合并显示 RSRP（44%（RSRP -89 dBm））
// 布局改动（对应审查报告 P1-P9 / F1 / F5）：
//  P1 控制区拆为「网络配置 / 操作 / 诊断工具」三组，诊断工具默认折叠
//  P2 危险操作（禁用/复位）红色常驻 + 后果文案 + 双重确认
//  P3 信号质量评级（RSRP/SINR 分级色标）
//  P4 IMEI/ICCID/IMSI 默认掩码，点击显示
//  P5 当前频段 chip 展示 + 频段下拉
//  P6 自动刷新改为局部刷新（仅重拉 status，不整页 reload）
//  P7 顶部异常横幅（模块禁用/未注册/数据面未附着/无IP/看门狗停止）
//  P8 控制行统一 flex-wrap 移动端适配
//  P9 端口信息移入诊断工具区；更新时间移近顶部
//  F1 APN 运营商预设下拉
//  F5 一键诊断报告下载
//  F2 看门狗管理：UI 预留（需后端新增 watchdog_set 方法后方可启用）
// =====================================================================

const callStatus = rpc.declare({ object: 'modem5g', method: 'status', expect: {} });
const callRedial = rpc.declare({ object: 'modem5g', method: 'redial', expect: {} });
const callSetApn = rpc.declare({ object: 'modem5g', method: 'set_apn', params: [ 'apn', 'user', 'password' ], expect: {} });
const callSetMode = rpc.declare({ object: 'modem5g', method: 'set_mode', params: [ 'allowed', 'preferred' ], expect: {} });
const callEnable = rpc.declare({ object: 'modem5g', method: 'enable', expect: {} });
const callDisable = rpc.declare({ object: 'modem5g', method: 'disable', expect: {} });
const callScan = rpc.declare({ object: 'modem5g', method: 'scan', expect: {} });
const callReset = rpc.declare({ object: 'modem5g', method: 'reset', expect: {} });
const callSetBands = rpc.declare({ object: 'modem5g', method: 'set_bands', params: [ 'bands' ], expect: {} });
const callSmsList = rpc.declare({ object: 'modem5g', method: 'sms_list', expect: {} });
const callSmsSend = rpc.declare({ object: 'modem5g', method: 'sms_send', params: [ 'number', 'text' ], expect: {} });
const callSmsDelete = rpc.declare({ object: 'modem5g', method: 'sms_delete', params: [ 'index' ], expect: {} });
const callAutoBack = rpc.declare({ object: 'modem5g', method: 'auto_back', params: [ 'seconds' ], expect: {} });
const callUsage = rpc.declare({ object: 'modem5g', method: 'usage', expect: {} });
const callSimInfo = rpc.declare({ object: 'modem5g', method: 'sim_info', expect: {} });
const callPing = rpc.declare({ object: 'modem5g', method: 'ping_test', params: [ 'host' ], expect: {} });
const callUssd = rpc.declare({ object: 'modem5g', method: 'ussd_query', params: [ 'code' ], expect: {} });
const callWatchdog = rpc.declare({ object: 'modem5g', method: 'watchdog_status', expect: {} });
const callAtCmd = rpc.declare({ object: 'modem5g', method: 'at_cmd', params: [ 'cmd' ], expect: {} });
const callTemp = rpc.declare({ object: 'modem5g', method: 'temp', expect: {} });
const callTrend = rpc.declare({ object: 'modem5g', method: 'trend', params: [ 'n' ], expect: {} });
const callSpeed = rpc.declare({ object: 'modem5g', method: 'speed', expect: {} });
const callDiag = rpc.declare({ object: 'modem5g', method: 'diagnostic', params: [ 'action' ], expect: {} });
// v4 新增
const callWatchdogSet = rpc.declare({ object: 'modem5g', method: 'watchdog_set', params: [ 'action' ], expect: {} });
const callWatchdogLog = rpc.declare({ object: 'modem5g', method: 'watchdog_log', params: [ 'n' ], expect: {} });
const callDeepSignal = rpc.declare({ object: 'modem5g', method: 'deep_signal', expect: {} });
const callSignalGuard = rpc.declare({ object: 'modem5g', method: 'signal_guard', params: [ 'action', 'enabled', 'threshold' ], expect: {} });
const callTrafficStats = rpc.declare({ object: 'modem5g', method: 'traffic_stats', expect: {} });
const callHealthCheck = rpc.declare({ object: 'modem5g', method: 'health_check', expect: {} });
const callListLeds = rpc.declare({ object: 'modem5g', method: 'list_leds', expect: {} });
const callLedMap = rpc.declare({ object: 'modem5g', method: 'led_map', params: [ 'led', 'enabled' ], expect: {} });
const callModuleProfile = rpc.declare({ object: 'modem5g', method: 'module_profile', expect: {} });

// 速率趋势：rt 累计差值 / 时间间隔 → Mbps（采样 60s）
function trendRate(points) {
	const out = [];
	for (let i = 1; i < points.length; i++) {
		const r1 = parseFloat(points[i - 1].rt);
		const r2 = parseFloat(points[i].rt);
		if (!isNaN(r1) && !isNaN(r2) && r2 >= r1) {
			const dt = (parseFloat(points[i].t) - parseFloat(points[i - 1].t)) || 60;
			out.push({ t: points[i].t, rate: (r2 - r1) * 8 / dt / 1e6 });
		}
	}
	return out;
}

// SVG 趋势折线图（innerHTML 构造，LuCI E() 不处理 SVG 命名空间）
function trendSvg(points, key, min, max, color, label, unit) {
	const W = 430, H = 88;
	const vals = [];
	for (let i = 0; i < points.length; i++) {
		const v = parseFloat(points[i][key]);
		if (!isNaN(v)) vals.push(v);
	}
	if (vals.length < 2)
		return '<div style="color:#888;padding:8px">数据采集中…（约每 1 分钟 1 点）</div>';
	let minV = Math.min.apply(null, vals.concat([ min ]));
	let maxV = Math.max.apply(null, vals.concat([ max ]));
	const range = (maxV - minV) || 1;
	const n = vals.length;
	const x = function(i) { return 42 + (i / (n - 1)) * (W - 52); };
	const y = function(v) { return 6 + (1 - (v - minV) / range) * (H - 14); };
	let path = '';
	for (let i = 0; i < n; i++)
		path += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(vals[i]).toFixed(1) + ' ';
	const last = vals[n - 1];
	return '<svg width="' + W + '" height="' + H + '" style="display:block;background:#fff;border:1px solid #eee">'
		+ '<path d="' + path + '" stroke="' + color + '" stroke-width="1.5" fill="none"/>'
		+ '<text x="8" y="12" font-size="10" fill="' + color + '">' + label + ' 当前 ' + last.toFixed(1) + unit + '</text>'
		+ '<text x="8" y="' + (H - 4) + '" font-size="9" fill="#aaa">范围 ' + minV.toFixed(0) + ' ~ ' + maxV.toFixed(0) + '</text>'
		+ '</svg>';
}

function section(title, rows) {
	const tbody = E('tbody', {});
	rows.forEach(function(r) {
		tbody.appendChild(E('tr', {}, [
			E('td', { 'class': 'td left' }, [ r[0] + '：' ]),
			E('td', { 'class': 'td left' }, [ r[1] || '—' ])
		]));
	});
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, [ title ]),
		E('table', { 'class': 'cbi-section-table' }, [ tbody ])
	]);
}

function notify(text) {
	ui.addNotification(null, E('p', {}, [ text ]));
}

// ===== 中文映射（减少英文信息）=====
const TECH_CN = { '5gnr': '5G', 'lte': '4G LTE', 'umts': '3G', 'gsm': '2G', 'cdma': 'CDMA' };
const STATE_CN = { 'registered': '已注册', 'connected': '已连接', 'enabled': '已启用', 'disabled': '已禁用', 'searching': '搜索中', 'locked': '已锁定', 'initializing': '初始化中', 'unknown': '未知' };
const REG_CN = { 'home': '归属网络', 'roaming': '漫游中', 'searching': '搜索中', 'denied': '被拒绝', 'unknown': '未知' };
const PACKET_CN = { 'attached': '已附着', 'detached': '未附着', 'searching': '搜索中', 'unknown': '未知' };
const OP_CN = { 'CMCC': '中国移动', 'CHN-CT': '中国电信', 'CHN-UNICOM': '中国联通', 'CHN-CUGSM': '中国联通' };
const MFG_CN = { 'QCOM': '高通 (Qualcomm)' };
const SMS_STATE_CN = { 'received': '已接收', 'sent': '已发送', 'stored': '已存储', 'draft': '草稿', 'pending': '发送中', 'unknown': '未知' };
const cn = function(map, v) { return (v && map[v]) ? map[v] : v; };

// ===== P3 信号质量评级 =====
const SIG_COLORS = { '优': '#52C41A', '良': '#FAAD14', '差': '#EA6668' };
function sigRating(rsrpStr, snrStr) {
	const rsrp = parseFloat(rsrpStr), snr = parseFloat(snrStr);
	if (isNaN(rsrp)) return { label: '', color: '' };
	// 无效信号值（如 NSA 无 LTE 锚点时 MM 报 -156/-140 下限）：不参与优/良/差评级
	if (rsrp <= -140) return { label: '无锚点', color: '#8b8b8b' };
	let label = '差', color = SIG_COLORS['差'];
	if (rsrp >= -95) { label = '优'; color = SIG_COLORS['优']; }
	else if (rsrp >= -110) { label = '良'; color = SIG_COLORS['良']; }
	if (!isNaN(snr) && snr >= 5 && rsrp >= -95) { label = '优'; color = SIG_COLORS['优']; }
	else if (!isNaN(snr) && snr >= 5 && rsrp >= -110) { label = '良'; color = SIG_COLORS['良']; }
	return { label: label, color: color };
}
function sigNode(rsrpStr, snrStr) {
	const r = sigRating(rsrpStr, snrStr);
	if (!r.label) return null;
	return E('span', { 'style': 'display:inline-block;background:' + r.color + '22;color:' + r.color + ';border:1px solid ' + r.color + '55;border-radius:4px;padding:0 6px;margin-left:6px;font-size:11px' }, [ r.label ]);
}

// ===== P4 敏感信息掩码（与 MCP 侧策略一致：前6******后3）=====
function maskId(v) {
	if (!v) return '—';
	if (String(v).length > 12) return String(v).slice(0, 6) + '******' + String(v).slice(-3);
	return String(v);
}
function maskedNode(value) {
	const node = E('span', { 'style': 'cursor:pointer;border-bottom:1px dashed #999', 'title': '点击显示/隐藏' }, [ maskId(value) ]);
	let shown = false;
	node.addEventListener('click', function() {
		shown = !shown;
		node.textContent = shown ? value : maskId(value);
	});
	return node;
}

// ===== P5 频段 chip 展示（v4.1：默认收起，展开按钮）=====
function bandChips(bands, limit) {
	const all = (bands || []);
	const wrap = E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center' });
	function chip(b) {
		const label = String(b).replace(/^ngran-/, 'n').replace(/^eutran-/, 'B').replace(/^utran-/, 'U');
		return E('span', { 'style': 'display:inline-block;background:#E4E3DD;border-radius:4px;padding:1px 8px;font-size:11px;color:#333' }, [ label ]);
	}
	if (!all.length) {
		wrap.appendChild(E('span', { 'style': 'color:#888;font-size:11px' }, [ '无（自动）' ]));
		return wrap;
	}
	const showAll = (limit && all.length > limit);
	(showAll ? all.slice(0, limit) : all).forEach(function(b) { wrap.appendChild(chip(b)); });
	if (showAll) {
		const rest = E('span', { 'style': 'display:none' });
		all.slice(limit).forEach(function(b) { rest.appendChild(chip(b)); });
		wrap.appendChild(rest);
		const btn = E('button', { 'class': 'btn', 'style': 'padding:0 8px;font-size:11px;margin-left:4px' }, [ '展开全部 ' + all.length + ' 个' ]);
		btn.addEventListener('click', function() {
			rest.style.display = 'inline';
			btn.style.display = 'none';
		});
		wrap.appendChild(btn);
	}
	return wrap;
}

// ===== 制式选项 =====
const MODE_OPTS = [
	{ label: '3G+4G+5G（默认）', allowed: '3g|4g|5g', preferred: '5g' },
	{ label: '4G+5G', allowed: '4g|5g', preferred: '5g' },
	{ label: '仅 5G', allowed: '5g', preferred: '' },
	{ label: '仅 4G', allowed: '4g', preferred: '' },
	{ label: '3G+4G', allowed: '3g|4g', preferred: '4g' },
	{ label: '仅 3G', allowed: '3g', preferred: '' }
];
function curModeKey(allowed) {
	const a = (allowed || '').replace(/,/g, '').trim().split(' ').filter(Boolean).join('|');
	for (let i = 0; i < MODE_OPTS.length; i++)
		if (MODE_OPTS[i].allowed === a) return i;
	return -1;
}

// ===== F1 APN 运营商预设 =====
const APN_PRESETS = [
	{ label: '自定义…', apn: '', user: '', pass: '' },
	{ label: '中国移动 cmnet', apn: 'cmnet' },
	{ label: '中国移动 cmwap', apn: 'cmwap' },
	{ label: '中国联通 3gnet', apn: '3gnet' },
	{ label: '中国联通 wonet', apn: 'wonet' },
	{ label: '中国电信 ctlte', apn: 'ctlte' },
	{ label: '中国广电 10099', apn: '10099' }
];

// ===== 控制行通用样式（P8 移动端）=====
const rowFlex = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
const selStyle = 'min-width:0;max-width:100%';

return view.extend({
	render: function() {
		return callStatus().then(function(info) {
			if (!info || !info.model)
				return E('div', { 'class': 'alert-message' },
					[ '5G 模块未就绪：ModemManager 无响应或模块未接入' ]);

			const okStates = [ 'registered', 'connected', 'enabled' ];
			const stateOk = okStates.indexOf(info.state) > -1;
			const stateBadge = E('span', { 'class': 'cbi-status-' + (stateOk ? 'ok' : 'failed') },
				[ cn(STATE_CN, info.state) || '未知' ]);
			const sig = info.signal ? info.signal + '%' : '—';
			const has5gSig = info.signal_5g_rsrp && info.signal_5g_rsrp !== '--';
			const hasLteSig = info.signal_lte_rsrp && info.signal_lte_rsrp !== '--';
			const sigNode5g = E('span', {}, [
				has5gSig ? E('span', {}, [ 'RSRP ' + info.signal_5g_rsrp + ' dBm / SINR ' + info.signal_5g_snr + ' dB' ]) : '—',
				has5gSig ? sigNode(info.signal_5g_rsrp, info.signal_5g_snr) : null
			]);
			const sigNodeLte = E('span', {}, [
				hasLteSig ? E('span', {}, [ 'RSRP ' + info.signal_lte_rsrp + ' dBm / SINR ' + info.signal_lte_snr + ' dB',
					(parseFloat(info.signal_lte_rsrp) <= -140) ? E('span', { 'style': 'color:#888;font-size:11px' }, [ '（无 LTE 锚点，NSA 正常）' ]) : null ]) : '—',
				hasLteSig ? sigNode(info.signal_lte_rsrp, info.signal_lte_snr) : null
			]);

			// ===== P7 异常横幅（顶部）=====
			const bannerBox = E('div', { 'style': 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px' });
			function pushBanner(cls, text) {
				bannerBox.appendChild(E('div', { 'class': cls, 'style': 'margin-bottom:0' }, [ text ]));
			}
			if (info.state === 'disabled') {
				pushBanner('alert-message', '⚠ 模块已禁用（启用后数据面恢复）');
			} else if (!stateOk) {
				pushBanner('alert-message', '⚠ 模块状态异常：' + (cn(STATE_CN, info.state) || info.state));
			}
			if (info.registration && info.registration === 'searching')
				pushBanner('alert-message', '⚠ 正在搜索网络…');
			if (info.registration === 'denied')
				pushBanner('alert-message', '⚠ 网络注册被拒绝（检查 SIM 卡/套餐/锁网）');
			if (info.packet_state && info.packet_state !== 'attached' && info.registration === 'home' && stateOk)
				pushBanner('alert-message', '⚠ 数据面未附着（数据包服务不可用）');
			if (stateOk && !info.wwan0_ipv4)
				pushBanner('alert-message', '⚠ 数据面无 IPv4 地址（可尝试重拨）');

			// ===== 看门狗（异步，用于横幅 + 诊断区）=====
			const watchdogNode = E('span', {}, [ '…' ]);
			callWatchdog().then(function(r) {
				const firstLog = (r.recent && r.recent !== '暂无重拨记录') ? r.recent.split('\n')[0] : '';
				watchdogNode.textContent = (r.running ? '✅ 运行中' : '⚠ 未运行') + (firstLog ? '（最近自动重拨：' + firstLog + '）' : '');
				if (!r.running)
					pushBanner('alert-message', '⚠ 数据面看门狗未运行（建议在 rc.local 启用，防止假连接/断线无人重拨）');
			});

			// ===== 控制操作区 =====

			// --- 重拨（两次点击确认） ---
			let armed = false, armTimer = null;
			const btnRedial = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					if (!armed) {
						armed = true;
						btnRedial.classList.add('cbi-button-negative');
						btnRedial.firstChild.nodeValue = '再次点击确认重拨';
						notify('⚠️ 再次点击确认重拨（数据面将断开约 30 秒）');
						armTimer = setTimeout(function() {
							armed = false;
							btnRedial.classList.remove('cbi-button-negative');
							btnRedial.firstChild.nodeValue = '重拨数据面';
						}, 4000);
						return;
					}
					clearTimeout(armTimer);
					armed = false;
					btnRedial.disabled = true;
					btnRedial.firstChild.nodeValue = '重拨中…';
					const guard = setTimeout(function() {
						btnRedial.disabled = false;
						btnRedial.firstChild.nodeValue = '重拨数据面';
						notify('⏳ 请求超时返回（后端可能仍在执行），稍后刷新状态');
					}, 40000);
					callRedial().then(function(r) {
						clearTimeout(guard);
						btnRedial.disabled = false;
						btnRedial.firstChild.nodeValue = '重拨数据面';
						notify(r.ok ? '✅ 重拨成功，新 IP：' + (r.ipv4 || '') : '⏳ ' + (r.detail || '重拨进行中'));
						setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						clearTimeout(guard);
						btnRedial.disabled = false;
						btnRedial.firstChild.nodeValue = '重拨数据面';
						notify('⏳ 请求失败，请重试');
					});
				}
			}, [ '重拨数据面' ]);

			// --- 网络制式下拉 + 应用 ---
			const selMode = E('select', { 'class': 'cbi-input-select', 'style': selStyle });
			MODE_OPTS.forEach(function(o, i) {
				selMode.appendChild(E('option', { 'value': String(i) }, [ o.label ]));
			});
			const curKey = curModeKey(info.cur_allowed);
			if (curKey >= 0) selMode.value = String(curKey);
			const btnMode = E('button', {
				'id': 'm5g-btn-mode',
				'class': 'btn cbi-button-action',
				'click': function() {
					const o = MODE_OPTS[parseInt(selMode.value)];
					btnMode.disabled = true;
					btnMode.firstChild.nodeValue = '应用中…';
					callSetMode(o.allowed, o.preferred).then(function(r) {
						btnMode.disabled = false;
						btnMode.firstChild.nodeValue = '应用';
						notify(r.ok ? '✅ 网络制式已切换' : '❌ ' + (r.error || r.detail || '切换失败'));
						if (r.ok) setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						btnMode.disabled = false;
						btnMode.firstChild.nodeValue = '应用';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '应用' ]);

			// --- 模块启停 ---
			const moduleDisabled = (info.state === 'disabled');
			const btnEnable = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					btnEnable.disabled = true;
					btnEnable.firstChild.nodeValue = '启用中…';
					callEnable().then(function(r) {
						btnEnable.disabled = false;
						btnEnable.firstChild.nodeValue = '启用模块';
						notify(r.ok ? '✅ 模块已启用' : '❌ ' + (r.detail || '启用失败'));
						setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						btnEnable.disabled = false;
						btnEnable.firstChild.nodeValue = '启用模块';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '启用模块' ]);
			let dArm = false, dTimer = null;
			const btnDisable = E('button', {
				// P2 危险按钮：红色常驻 + 后果文案
				'class': 'btn cbi-button-negative',
				'style': 'font-weight:600',
				'click': function() {
					if (!dArm) {
						dArm = true;
						btnDisable.style.opacity = '0.6';
						btnDisable.firstChild.nodeValue = '再次点击确认禁用';
						notify('⚠️ 禁用会断开 5G（数据面中断，重拨后恢复），再次点击确认');
						dTimer = setTimeout(function() {
							dArm = false;
							btnDisable.style.opacity = '1';
							btnDisable.firstChild.nodeValue = '禁用模块（断开 5G）';
						}, 5000);
						return;
					}
					clearTimeout(dTimer);
					dArm = false;
					btnDisable.disabled = true;
					btnDisable.firstChild.nodeValue = '禁用中…';
					callDisable().then(function(r) {
						btnDisable.disabled = false;
						btnDisable.firstChild.nodeValue = '禁用模块（断开 5G）';
						notify(r.ok ? '✅ 模块已禁用' : '❌ ' + (r.detail || '禁用失败'));
						setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						btnDisable.disabled = false;
						btnDisable.firstChild.nodeValue = '禁用模块（断开 5G）';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '禁用模块（断开 5G）' ]);
			const moduleBtns = moduleDisabled ? [ btnEnable ] : [ btnDisable ];

			// --- 模块复位（P2 红色常驻 + 双重确认） ---
			let rArm = false, rTimer = null;
			const btnReset = E('button', {
				'class': 'btn cbi-button-negative',
				'style': 'font-weight:600',
				'click': function() {
					if (!rArm) {
						rArm = true;
						btnReset.style.opacity = '0.6';
						btnReset.firstChild.nodeValue = '再次点击确认复位';
						notify('⚠️ 模块复位将断开 5G 约 30-60 秒（自动恢复上网），再次点击确认');
						rTimer = setTimeout(function() {
							rArm = false;
							btnReset.style.opacity = '1';
							btnReset.firstChild.nodeValue = '复位模块（断网约 1 分钟）';
						}, 5000);
						return;
					}
					clearTimeout(rTimer);
					rArm = false;
					btnReset.disabled = true;
					btnReset.firstChild.nodeValue = '复位中…';
					callReset().then(function(r) {
						btnReset.disabled = false;
						btnReset.firstChild.nodeValue = '复位模块（断网约 1 分钟）';
						notify(r.ok ? '✅ ' + (r.detail || '复位命令已发送') : '❌ ' + (r.detail || '复位失败'));
						if (r.ok) {
							let tries = 0;
							const pt = setInterval(function() {
								tries++;
								callStatus().then(function(s2) {
									if (s2 && s2.model && s2.wwan0_ipv4) {
										clearInterval(pt);
										notify('✅ 模块已恢复上网');
										location.reload();
									} else if (tries >= 8) {
										clearInterval(pt);
										notify('⏳ 复位仍在进行，可稍后手动刷新页面');
									}
								});
							}, 15000);
						}
					}).catch(function() {
						btnReset.disabled = false;
						btnReset.firstChild.nodeValue = '复位模块（断网约 1 分钟）';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '复位模块（断网约 1 分钟）' ]);

			// --- 频段锁定（P5：当前频段 chip + 按运营商分组下拉） ---
			const all5g = (info.ngran_bands || []).join('|');
			const BAND_GROUPS = [
				{ label: '自动', opts: [ { label: '全频段（自动）', bands: 'any' } ] },
				{ label: '5G 频段', opts: [
					{ label: '5G 全网通（n1+n8+n28+n41+n78+n79）', bands: 'ngran-1|ngran-8|ngran-28|ngran-41|ngran-78|ngran-79' },
					{ label: '移动 5G（n28+n41+n79）', bands: 'ngran-28|ngran-41|ngran-79' },
					{ label: '电信 5G（n1+n78）', bands: 'ngran-1|ngran-78' },
					{ label: '联通 5G（n1+n8+n78）', bands: 'ngran-1|ngran-8|ngran-78' },
					{ label: '广电 5G（n28+n79）', bands: 'ngran-28|ngran-79' },
					{ label: '仅 5G（模块全部 n 频段）', bands: all5g, empty: !all5g }
				]},
				{ label: '4G 频段', opts: [
					{ label: '4G 全网通（B1+B3+B5+B8+B34+B38+B39+B40+B41）', bands: 'eutran-1|eutran-3|eutran-5|eutran-8|eutran-34|eutran-38|eutran-39|eutran-40|eutran-41' },
					{ label: '移动 4G（B3+B8+B34+B38+B39+B40+B41）', bands: 'eutran-3|eutran-8|eutran-34|eutran-38|eutran-39|eutran-40|eutran-41' },
					{ label: '电信 4G（B1+B3+B5+B8）', bands: 'eutran-1|eutran-3|eutran-5|eutran-8' },
					{ label: '联通 4G（B1+B3+B8+B40）', bands: 'eutran-1|eutran-3|eutran-8|eutran-40' },
					{ label: '广电 4G（B3+B8+B38+B39+B40）', bands: 'eutran-3|eutran-8|eutran-38|eutran-39|eutran-40' }
				]},
				{ label: '运营商全频（4G+5G）', opts: [
					{ label: '移动全频', bands: 'eutran-3|eutran-8|eutran-34|eutran-38|eutran-39|eutran-40|eutran-41|ngran-28|ngran-41|ngran-79' },
					{ label: '电信全频', bands: 'eutran-1|eutran-3|eutran-5|eutran-8|ngran-1|ngran-78' },
					{ label: '联通全频', bands: 'eutran-1|eutran-3|eutran-8|eutran-40|ngran-1|ngran-8|ngran-78' },
					{ label: '广电全频', bands: 'eutran-3|eutran-8|eutran-38|eutran-39|eutran-40|ngran-28|ngran-79' }
				]}
			];
			const bandSel = E('select', { 'id': 'm5g-sel-bands', 'class': 'cbi-input-select', 'style': selStyle });
			BAND_GROUPS.forEach(function(g) {
				const og = E('optgroup', { 'label': g.label });
				g.opts.forEach(function(o) {
					const opt = E('option', { 'value': o.bands }, [ o.label ]);
					if (o.empty) opt.disabled = true;
					og.appendChild(opt);
				});
				bandSel.appendChild(og);
			});
			const nBands = (info.cur_bands || []).length;
			const btnBands = E('button', {
				'id': 'm5g-btn-bands',
				'class': 'btn cbi-button-action',
				'click': function() {
					const bands = bandSel.value;
					btnBands.disabled = true;
					btnBands.firstChild.nodeValue = '应用中…';
					callSetBands(bands).then(function(r) {
						btnBands.disabled = false;
						btnBands.firstChild.nodeValue = '应用';
						notify(r.ok ? '✅ ' + (r.detail || '频段已设置') : '❌ ' + (r.error || r.detail || '设置失败'));
						if (r.ok) setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						btnBands.disabled = false;
						btnBands.firstChild.nodeValue = '应用';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '应用' ]);

			// --- 网络扫描（后台 + 轮询） ---
			const scanStatusText = E('span', { 'class': 'cbi-section-descr' }, []);
			const scanTable = E('table', { 'class': 'cbi-section-table' });
			let scanTimer = null;
			function renderScanResult(info2) {
				const nets = info2.scan_networks || [];
				if (!nets.length) {
					dom.content(scanTable, E('tr', {}, [ E('td', {}, [ '未扫描到网络' ]) ]));
					return;
				}
				const tbody = E('tbody', {});
				nets.forEach(function(n) {
					const avail = /available/.test(n.status);
					tbody.appendChild(E('tr', {}, [
						E('td', { 'class': 'td left' }, [ n.name || '—' ]),
						E('td', { 'class': 'td left' }, [ n.mccmnc ]),
						E('td', { 'class': 'td left' }, [
							E('span', { 'class': avail ? 'cbi-status-ok' : 'cbi-status-failed' }, [ n.status ])
						])
					]));
				});
				dom.content(scanTable, tbody);
			}
			function pollScan() {
				callStatus().then(function(info2) {
					if (info2.scan_state === 'running') {
						scanStatusText.textContent = '扫描中，约 60-90 秒…';
					} else if (info2.scan_state === 'done') {
						scanStatusText.textContent = '扫描完成：';
						renderScanResult(info2);
						clearInterval(scanTimer);
						btnScan.disabled = false;
						btnScan.firstChild.nodeValue = '重新扫描';
					} else {
						scanStatusText.textContent = '已取消或失败';
						clearInterval(scanTimer);
						btnScan.disabled = false;
						btnScan.firstChild.nodeValue = '重新扫描';
					}
				});
			}
			const btnScan = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					btnScan.disabled = true;
					btnScan.firstChild.nodeValue = '扫描中…';
					dom.content(scanTable, '');
					callScan().then(function(r) {
						scanStatusText.textContent = r.started ? '扫描已启动，约 60-90 秒…' : (r.detail || '');
						if (r.started) notify('⚠️ 扫描期间网络会断开约 1-3 分钟（网络搜索需短暂离网）');
						clearInterval(scanTimer);
						scanTimer = setInterval(pollScan, 6000);
					}).catch(function() {
						btnScan.disabled = false;
						btnScan.firstChild.nodeValue = '开始扫描';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '开始扫描' ]);
			if (info.scan_state === 'running') {
				btnScan.disabled = true;
				btnScan.firstChild.nodeValue = '扫描中…';
				scanStatusText.textContent = '扫描进行中，约 60-90 秒…';
				scanTimer = setInterval(pollScan, 6000);
			} else if (info.scan_state === 'done') {
				scanStatusText.textContent = '上次扫描结果：';
				renderScanResult(info);
			}

			// --- APN 表单（F1 预设下拉 + 原表单） ---
			const apnInput = E('input', {
				'class': 'cbi-input-text',
				'style': 'width:200px;min-width:0',
				'placeholder': 'APN，如 cmnet',
				'value': info.cfg_apn || ''
			});
			const userInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:120px;min-width:0', 'placeholder': '用户名（可选）' });
			const passInput = E('input', { 'class': 'cbi-input-text', 'type': 'password', 'style': 'width:120px;min-width:0', 'placeholder': '密码（可选）' });
			const apnPreset = E('select', { 'class': 'cbi-input-select', 'style': selStyle });
			APN_PRESETS.forEach(function(p, i) {
				apnPreset.appendChild(E('option', { 'value': String(i) }, [ p.label ]));
			});
			apnPreset.addEventListener('change', function() {
				const p = APN_PRESETS[parseInt(apnPreset.value)];
				if (p.apn) apnInput.value = p.apn;
				userInput.value = p.user || '';
				passInput.value = p.pass || '';
			});
			const btnSave = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					const apn = apnInput.value.trim();
					if (!apn) { notify('⚠️ 请填写 APN'); return; }
					btnSave.disabled = true;
					btnSave.firstChild.nodeValue = '保存中…';
					const guard = setTimeout(function() {
						btnSave.disabled = false;
						btnSave.firstChild.nodeValue = '保存并重拨';
						notify('⏳ 请求超时返回（后端可能仍在重拨），稍后刷新状态');
					}, 40000);
					callSetApn(apn, userInput.value.trim(), passInput.value).then(function(r) {
						clearTimeout(guard);
						btnSave.disabled = false;
						btnSave.firstChild.nodeValue = '保存并重拨';
						notify(r.ok ? '✅ ' + (r.detail || 'APN 已更新') : '❌ ' + (r.error || '保存失败'));
						setTimeout(function() { location.reload(); }, 1500);
					}).catch(function() {
						clearTimeout(guard);
						btnSave.disabled = false;
						btnSave.firstChild.nodeValue = '保存并重拨';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '保存并重拨' ]);

			// ===== 智能选网（v4：信号阈值切换，默认关 + 风险提示）=====
			const guardState = E('span', { 'style': 'font-size:12px;color:#666' }, [ '…' ]);
			const guardThreshold = E('select', { 'class': 'cbi-input-select', 'style': selStyle });
			[ '-95', '-100', '-105', '-110', '-115', '-120' ].forEach(function(t) {
				guardThreshold.appendChild(E('option', { 'value': t }, [ t + ' dBm' ]));
			});
			const guardChk = E('input', { 'type': 'checkbox', 'id': 'm5g-guard' });
			guardChk.addEventListener('change', function() {
				guardChk.disabled = true;
				const en = guardChk.checked ? '1' : '0';
				const th = guardThreshold.value;
				if (en === '1' && !confirm('⚠ 开启智能选网：5G 信号弱于阈值时模块将自动切换到 4G（10 分钟后尝试恢复 5G）。\n确认开启？')) {
					guardChk.checked = false;
					guardChk.disabled = false;
					return;
				}
				callSignalGuard('set', en, th).then(function(r) {
					guardChk.disabled = false;
					notify(r.ok ? '✅ ' + (r.detail || '已设置') : '❌ ' + (r.error || r.detail || '设置失败'));
					if (r.ok) guardState.textContent = en === '1' ? '已开启' : '已关闭';
				}).catch(function() {
					guardChk.disabled = false;
					notify('❌ 请求失败，请重试');
				});
			});
			callSignalGuard('get', '', '').then(function(r) {
				if (!r) return;
				guardChk.checked = !!r.enabled;
				guardState.textContent = r.enabled ? '已开启（弱信号自动切 4G）' : '已关闭';
				if (r.threshold) guardThreshold.value = String(r.threshold);
			});

			// ===== 诊断工具区（P1/P9 折叠区）=====

			// --- 网络诊断 Ping ---
			const pingInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:150px;min-width:0', 'value': '223.5.5.5', 'placeholder': '目标 IP 或域名' });
			const pingResult = E('span', { 'class': 'cbi-section-descr' }, []);
			const btnPing = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					const host = pingInput.value.trim();
					if (!host) { notify('⚠️ 请输入目标'); return; }
					btnPing.disabled = true;
					btnPing.firstChild.nodeValue = '测试中…';
					pingResult.textContent = '';
					callPing(host).then(function(r) {
						btnPing.disabled = false;
						btnPing.firstChild.nodeValue = '测试';
						notify(r.ok ? '✅ ' + r.detail : '❌ ' + (r.error || r.detail || '测试失败'));
						if (r.ok)
							pingResult.textContent = '发送 ' + r.sent + ' / 接收 ' + r.recv + ' / 最小 ' + (r.min || '—') + ' / 平均 ' + (r.avg || '—') + ' ms';
					}).catch(function() {
						btnPing.disabled = false;
						btnPing.firstChild.nodeValue = '测试';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '测试' ]);

			// --- USSD（T99W368 实测不支持，置灰） ---
			const ussdInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:150px', 'value': '*100#', 'placeholder': 'USSD 码（T99W368 实测不支持）', 'disabled': 'disabled' });
			const ussdResult = E('span', { 'class': 'cbi-section-descr' }, [ '该模块固件实测不支持 USSD 查询' ]);
			const btnUssd = E('button', { 'class': 'btn cbi-button-action', 'disabled': 'disabled' }, [ '不支持（已禁用）' ]);

			// --- AT 查询（预设只读指令） ---
			const AT_OPTS = [
				{ label: 'ATI（模块信息/IMEI）', cmd: 'ATI' },
				{ label: 'AT+COPS?（运营商/接入制式）', cmd: 'AT+COPS?' },
				{ label: 'AT+C5GREG?（5G 注册）', cmd: 'AT+C5GREG?' },
				{ label: 'AT+CIMI（IMSI）', cmd: 'AT+CIMI' },
				{ label: 'AT+CPIN?（SIM 状态）', cmd: 'AT+CPIN?' },
				{ label: 'AT+CFUN?（射频功能）', cmd: 'AT+CFUN?' },
				{ label: 'AT+CEREG?（LTE 注册）', cmd: 'AT+CEREG?' },
				{ label: 'AT+CGCONTRDP=5（当前数据面 IP/DNS）', cmd: 'AT+CGCONTRDP=5' },
				{ label: 'AT+CGDCONT?（PDP 上下文列表）', cmd: 'AT+CGDCONT?' },
				{ label: 'AT+CGACT?（上下文激活状态）', cmd: 'AT+CGACT?' },
				{ label: 'AT+CSQ（信号）', cmd: 'AT+CSQ' },
				{ label: 'AT+CGMR（固件版本）', cmd: 'AT+CGMR' },
				{ label: 'AT+temp?（模块温度）', cmd: 'AT+temp?' }
			];
			const atSel = E('select', { 'id': 'm5g-sel-at', 'class': 'cbi-input-select', 'style': selStyle });
			AT_OPTS.forEach(function(o, i) {
				atSel.appendChild(E('option', { 'value': String(i) }, [ o.label ]));
			});
			const atResult = E('span', {}, [ '选择指令后点执行' ]);
			const btnAt = E('button', {
				'id': 'm5g-btn-at',
				'class': 'btn cbi-button-action',
				'click': function() {
					const o = AT_OPTS[parseInt(atSel.value)];
					btnAt.disabled = true;
					btnAt.firstChild.nodeValue = '执行中…';
					atResult.textContent = '执行中（约 10 秒）…';
					callAtCmd(o.cmd).then(function(r) {
						btnAt.disabled = false;
						btnAt.firstChild.nodeValue = '执行';
						atResult.textContent = r.ok ? r.output : ('❌ ' + (r.error || r.output || '无响应'));
					}).catch(function() {
						btnAt.disabled = false;
						btnAt.firstChild.nodeValue = '执行';
						atResult.textContent = '❌ 请求失败，请重试';
					});
				}
			}, [ '执行' ]);

			// --- 一键诊断（F5 加下载） ---
			const diagPre = E('pre', { 'style': 'white-space:pre-wrap;background:#f5f5f5;border:1px solid #ddd;padding:8px;margin-top:6px;max-height:260px;overflow-y:auto;min-width:100%;box-sizing:border-box' }, [ '点击"生成报告"开始诊断（约 60 秒）' ]);
			const btnDiag = E('button', {
				'id': 'm5g-btn-diag',
				'class': 'btn cbi-button-action',
				'click': function() {
					btnDiag.disabled = true;
					btnDiag.firstChild.nodeValue = '诊断中…';
					diagPre.textContent = '诊断进行中，约 60 秒…';
					callDiag('start').then(function(r) {
						notify(r.ok ? '✅ ' + r.detail : '❌ 启动失败');
						let tries = 0;
						const timer = setInterval(function() {
							tries++;
							callDiag('get').then(function(r2) {
								if (r2.ok) {
									clearInterval(timer);
									btnDiag.disabled = false;
									btnDiag.firstChild.nodeValue = '生成报告';
									diagPre.textContent = r2.output;
								} else if (tries >= 12) {
									clearInterval(timer);
									btnDiag.disabled = false;
									btnDiag.firstChild.nodeValue = '生成报告';
									diagPre.textContent = '报告生成超时，请重试';
								}
							});
						}, 8000);
					});
				}
			}, [ '生成报告' ]);
			const btnDiagDl = E('button', {
				'class': 'btn',
				'click': function() {
					const txt = diagPre.textContent || '';
					if (!txt || /生成|诊断/.test(txt.slice(0, 12))) { notify('⚠️ 请先生成诊断报告'); return; }
					try {
						const blob = new Blob([ txt ], { 'type': 'text/plain' });
						const a = document.createElement('a');
						a.href = URL.createObjectURL(blob);
						a.download = 'modem5g-diag-' + new Date().toISOString().slice(0, 10) + '.txt';
						a.click();
						setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
					} catch (e) {
						notify('❌ 浏览器不支持下载，可手动复制');
					}
				}
			}, [ '下载报告' ]);

			// ===== 分区组装（P1）=====

			// 网络配置区：制式 / 频段（含 chip）/ APN（含预设）
			const cfgSection = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ '网络配置' ]),
				E('div', { 'class': 'cbi-map' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络制式' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ selMode, btnMode ]),
							E('div', { 'style': 'margin-top:4px;font-size:12px;color:#666' },
								[ '当前：' + (info.cur_allowed || '—') + '（优先 ' + (info.cur_preferred || '—') + '）' ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '频段锁定' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ bandSel, btnBands ]),
							E('div', { 'style': 'margin-top:4px;font-size:12px;color:#666' },
								[ '当前启用 ' + nBands + ' 个频段：' ]),
							bandChips(info.cur_bands, 16)
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'APN 参数' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ apnPreset ]),
							E('div', { 'style': rowFlex + ';margin-top:6px' }, [ apnInput, userInput, passInput, btnSave ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '智能选网（信号阈值切换）' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [
								E('label', { 'style': 'cursor:pointer' }, [ guardChk, ' 5G 信号弱时自动切 4G' ]),
								' 阈值 ', guardThreshold
							]),
							E('div', { 'style': 'margin-top:4px' }, [ guardState ]),
							E('div', { 'style': 'margin-top:4px;font-size:12px;color:#b02a2c' },
								[ '⚠ 默认关闭；开启后模块制式由信号自动切换，冷却 10 分钟尝试恢复 5G。' ])
						])
					])
				])
			]);

			// 操作区：数据面 / 扫描 / 电源（危险红色）
			const ctrlSection = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ '操作' ]),
				E('div', { 'class': 'cbi-map' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '数据面' ]),
						E('div', { 'class': 'cbi-value-field' }, [ btnRedial ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络扫描' ]),
						E('div', { 'class': 'cbi-value-field' }, [ E('div', { 'style': rowFlex }, [ btnScan, scanStatusText ]) ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '模块电源（危险操作）' ]),
						E('div', { 'class': 'cbi-value-field' }, [ E('div', { 'style': rowFlex }, moduleBtns.concat([ btnReset ])) ])
					])
				]),
				E('div', { 'class': 'cbi-section-descr' },
					[ '⚠ 危险操作（红色按钮）会中断 5G 数据面：禁用需手动启用恢复；复位约 1 分钟后自动恢复。管理走有线 LAN 不受影响。' ])
			]);

			// ===== v4：看门狗开关 =====
			const btnWd = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					btnWd.disabled = true;
					const act = (btnWd.firstChild.nodeValue === '启动看门狗') ? 'start' : 'stop';
					btnWd.firstChild.nodeValue = '处理中…';
					callWatchdogSet(act).then(function(r) {
						btnWd.disabled = false;
						notify(r.ok ? '✅ ' + (r.detail || '已执行') : '❌ ' + (r.error || r.detail || '执行失败'));
						if (r.ok) {
							btnWd.firstChild.nodeValue = (act === 'start') ? '停止看门狗' : '启动看门狗';
							location.reload();
						}
					}).catch(function() {
						btnWd.disabled = false;
						btnWd.firstChild.nodeValue = (act === 'start') ? '停止看门狗' : '启动看门狗';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '…' ]);
			callWatchdogSet('status').then(function(r) {
				if (!r) return;
				btnWd.firstChild.nodeValue = r.running ? '停止看门狗' : '启动看门狗';
			});
			// ===== v4：断网事件时间线 =====
			const wdLogTable = E('table', { 'class': 'cbi-section-table' });
			const wdLogWrap = E('div', { 'style': 'max-height:220px;overflow-y:auto;margin-top:6px' }, [ wdLogTable ]);
			const wdLogHint = E('span', { 'class': 'cbi-section-descr' }, []);
			function renderWdLog(evts) {
				if (!evts || !evts.length) {
					dom.content(wdLogTable, E('tr', {}, [ E('td', {}, [ '暂无断网/重拨记录' ]) ]));
					return;
				}
				const tbody = E('tbody', {});
				evts.forEach(function(e) {
					const cls = e.type === 'redial' ? 'cbi-status-failed' : (e.type === 'enable' ? 'cbi-status-ok' : '');
					tbody.appendChild(E('tr', {}, [
						E('td', { 'class': 'td left', 'style': 'white-space:nowrap' }, [ e.time || '—' ]),
						E('td', { 'class': 'td left' }, [ E('span', { 'class': cls }, [ e.msg ]) ])
					]));
				});
				dom.content(wdLogTable, tbody);
			}
			callWatchdogLog('30').then(function(r) {
				wdLogHint.textContent = '最近 ' + (r && r.count ? r.count : 0) + ' 条事件（重拨/启用/MM 重启）';
				const evts = (r && r.events) ? r.events : [];
				renderWdLog(evts.slice(0, 5));
				if (evts.length > 5) {
					const btnMore = E('button', { 'class': 'btn', 'style': 'margin-top:6px;padding:0 10px;font-size:12px' }, [ '展开全部 ' + evts.length + ' 条' ]);
					btnMore.addEventListener('click', function() {
						renderWdLog(evts);
						btnMore.style.display = 'none';
					});
					wdLogWrap.appendChild(btnMore);
				}
			});
			// ===== v4：一键网络体检 =====
			const hcTable = E('table', { 'class': 'cbi-section-table' });
			const hcResult = E('span', { 'class': 'cbi-section-descr' }, []);
			const btnHc = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					btnHc.disabled = true;
					btnHc.firstChild.nodeValue = '体检中（约 15 秒）…';
					hcResult.textContent = '';
					callHealthCheck().then(function(r) {
						btnHc.disabled = false;
						btnHc.firstChild.nodeValue = '一键体检';
						hcResult.textContent = (r && r.summary) ? ('✅ ' + r.summary) : '执行失败';
						if (r && r.items) {
							const tbody = E('tbody', {});
							r.items.forEach(function(it) {
								tbody.appendChild(E('tr', {}, [
									E('td', { 'class': 'td left' }, [ it.name ]),
									E('td', { 'class': 'td left' }, [
										E('span', { 'class': it.ok ? 'cbi-status-ok' : 'cbi-status-failed' }, [ it.ok ? '✓ 通过' : '✗ 失败' ]),
										' ' + (it.detail || '')
									])
								]));
							});
							dom.content(hcTable, tbody);
						}
					}).catch(function() {
						btnHc.disabled = false;
						btnHc.firstChild.nodeValue = '一键体检';
						notify('❌ 请求失败，请重试');
					});
				}
			}, [ '一键体检' ]);
			// ===== v4：LED 状态联动 =====
			const ledSel = E('select', { 'class': 'cbi-input-select', 'style': selStyle });
			const ledChk = E('input', { 'type': 'checkbox', 'id': 'm5g-led' });
			const ledHint = E('span', { 'style': 'font-size:12px;color:#666' }, [ '…' ]);
			ledChk.addEventListener('change', function() {
				ledChk.disabled = true;
				const en = ledChk.checked ? '1' : '0';
				callLedMap(ledSel.value, en).then(function(r) {
					ledChk.disabled = false;
					notify(r.ok ? '✅ ' + (r.detail || '已设置') : '❌ ' + (r.error || r.detail || '设置失败'));
					if (r.ok) ledHint.textContent = en === '1' ? '已开启（亮=已连接）' : '已关闭';
				}).catch(function() {
					ledChk.disabled = false;
					notify('❌ 请求失败，请重试');
				});
			});
			callListLeds().then(function(r) {
				if (!r) return;
				(r.leds || []).forEach(function(l) {
					ledSel.appendChild(E('option', { 'value': l }, [ l ]));
				});
				if (r.current) ledSel.value = r.current;
				ledChk.checked = !!r.enabled;
				ledHint.textContent = r.enabled ? '已开启（亮=已连接）' : '已关闭';
			});

			// 诊断工具区（P1 折叠）
			const diagSection = E('details', { 'class': 'cbi-section' }, [
				E('summary', { 'style': 'cursor:pointer;font-weight:bold' }, [ '🔧 诊断工具（点击展开：看门狗 / Ping / USSD / AT 查询 / 一键诊断）' ]),
				E('div', { 'style': 'margin-top:8px' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '数据面看门狗' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ watchdogNode, btnWd ]),
							E('div', { 'style': 'margin-top:6px' }, [ wdLogHint ]),
							wdLogWrap
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络诊断 Ping' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ pingInput, btnPing ]),
							E('div', { 'style': 'margin-top:6px' }, [ pingResult ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '一键网络体检（v4）' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ btnHc, hcResult ]),
							E('div', { 'style': 'margin-top:6px' }, [ hcTable ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'LED 状态联动（v4）' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [
								E('label', { 'style': 'cursor:pointer' }, [ ledChk, ' 已连接时点亮' ]),
								ledSel, ' ', ledHint
							])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'USSD 查询' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ ussdInput, btnUssd ]),
							E('div', { 'style': 'margin-top:6px' }, [ ussdResult ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'AT 查询（ADB 通道，预设只读指令）' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ atSel, btnAt ]),
							E('pre', { 'style': 'white-space:pre-wrap;background:#f5f5f5;border:1px solid #ddd;padding:8px;margin-top:6px;max-height:200px;overflow-y:auto;min-width:100%;box-sizing:border-box' }, [ atResult ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '一键诊断' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ btnDiag, btnDiagDl ]),
							diagPre
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '端口信息（调试）' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('span', {}, [ '主端口 ' + (info.primary_port || '—') + ' · ' + (info.ports || '—') ])
						])
					])
				])
			]);

			// ===== 短信区（保留：折叠 + 懒加载）=====
			const smsTable = E('table', { 'class': 'cbi-section-table' });
			const smsTableWrap = E('div', { 'style': 'max-height:360px;overflow-y:auto' }, [ smsTable ]);
			const smsStatus = E('span', { 'class': 'cbi-section-descr' }, [ '加载中…' ]);
			function renderSms(list) {
				if (!list || !list.length) {
					dom.content(smsTable, E('tr', {}, [ E('td', {}, [ '收件箱为空' ]) ]));
					return;
				}
				const tbody = E('tbody', {});
				list.forEach(function(s) {
					const t = (s.timestamp || '').replace('T', ' ').slice(0, 16);
					const btnDel = E('button', {
						'class': 'btn cbi-button-negative',
						'click': function() {
							callSmsDelete(s.index).then(function(r) {
								notify(r.ok ? '✅ 短信已删除' : '❌ ' + (r.detail || '删除失败'));
								refreshSms();
							}).catch(function() {
								notify('❌ 删除请求失败，请重试');
							});
						}
					}, [ '删除' ]);
					const fullText = s.text || '—';
					const shortText = fullText.length > 24 ? fullText.slice(0, 24) + '…' : fullText;
					let smsExpanded = false;
					const contentDiv = E('div', {
						'class': 'm5g-sms-body',
						'style': 'white-space:pre-wrap;cursor:pointer;max-width:400px;color:#666;overflow:hidden',
						'click': function() {
							smsExpanded = !smsExpanded;
							contentDiv.textContent = smsExpanded ? fullText : shortText;
							contentDiv.style.color = smsExpanded ? '#000' : '#666';
						}
					}, [ shortText ]);
					tbody.appendChild(E('tr', {}, [
						E('td', { 'class': 'td left' }, [ t || '—' ]),
						E('td', { 'class': 'td left' }, [ s.number || '—' ]),
						E('td', { 'class': 'td left' }, [ contentDiv ]),
						E('td', { 'class': 'td left' }, [ cn(SMS_STATE_CN, s.state) || s.state ]),
						E('td', { 'class': 'td left' }, [ btnDel ])
					]));
				});
				dom.content(smsTable, tbody);
			}
			function refreshSms() {
				smsStatus.textContent = '加载中…';
				callSmsList().then(function(r) {
					smsStatus.textContent = '共 ' + (r.sms || []).length + ' 条短信';
					renderSms(r.sms || []);
				});
			}
			const numInput = E('input', {
				'class': 'cbi-input-text', 'style': 'width:220px;min-width:0',
				'placeholder': '接收号码，如 13800138000'
			});
			const textInput = E('textarea', {
				'class': 'cbi-input-text', 'style': 'width:100%;height:64px;box-sizing:border-box',
				'placeholder': '短信内容（≤500 字符，支持中文/长短信自动分片）'
			});
			const btnSmsSend = E('button', {
				'id': 'm5g-btn-smssend',
				'class': 'btn cbi-button-action',
				'click': function() {
					const num = numInput.value.trim();
					const txt = textInput.value.trim();
					if (!num) { notify('⚠️ 请输入接收号码'); return; }
					if (!txt) { notify('⚠️ 请输入短信内容'); return; }
					btnSmsSend.disabled = true;
					btnSmsSend.firstChild.nodeValue = '发送中…';
					const in4g = (info.cur_allowed === '4g');
					const doSend = function() {
						callSmsSend(num, txt).then(function(r) {
							btnSmsSend.disabled = false;
							btnSmsSend.firstChild.nodeValue = '发送短信';
							notify(r.ok ? '✅ ' + (r.detail || '已发送') : '❌ ' + (r.error || r.detail || '发送失败'));
							if (r.ok) {
								textInput.value = '';
								refreshSms();
							}
						}).catch(function() {
							btnSmsSend.disabled = false;
							btnSmsSend.firstChild.nodeValue = '发送短信';
							notify('❌ 请求失败，请重试');
						});
					};
					if (in4g) {
						doSend();
					} else {
						notify('🔄 5G 下无法发短信，自动切换 4G 发送…');
						callSetMode('4g', '').then(function(r) {
							if (!r.ok) {
								btnSmsSend.disabled = false;
								btnSmsSend.firstChild.nodeValue = '发送短信';
								notify('❌ 切 4G 失败: ' + (r.error || r.detail || ''));
								return;
							}
							callAutoBack('25');
							notify('📥 已切 4G，10 秒后自动发送；发送完成自动恢复原制式');
							setTimeout(doSend, 10000);
						}).catch(function() {
							btnSmsSend.disabled = false;
							btnSmsSend.firstChild.nodeValue = '发送短信';
							notify('❌ 切 4G 请求失败，请重试');
						});
					}
				}
			}, [ '发送短信' ]);
			const btnSmsRefresh = E('button', { 'class': 'btn', 'click': refreshSms }, [ '刷新' ]);
			const is4gMode = (info.cur_allowed === '4g');
			let autoBackTimer = null;
			const smsModeHint = E('span', { 'class': 'cbi-section-descr' }, []);
			const btnSmsMode = E('button', {
				'id': 'm5g-btn-smsmode',
				'class': 'btn cbi-button-action',
				'click': function() {
					btnSmsMode.disabled = true;
					btnSmsMode.firstChild.nodeValue = '切换中…';
					if (is4gMode) {
						clearTimeout(autoBackTimer);
						callAutoBack('0').then(function(r) {
							btnSmsMode.disabled = false;
							btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
							notify(r.ok ? '✅ ' + (r.detail || '已恢复原制式') : '❌ ' + (r.error || '切换失败'));
							setTimeout(function() { location.reload(); }, 1500);
						}).catch(function() {
							btnSmsMode.disabled = false;
							btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
							notify('❌ 请求失败，请重试');
						});
					} else {
						callSetMode('4g', '').then(function(r) {
							btnSmsMode.disabled = false;
							if (!r.ok) {
								btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
								notify('❌ ' + (r.error || r.detail || '切换失败'));
								return;
							}
							btnSmsMode.firstChild.nodeValue = '切回 5G 上网';
							smsModeHint.textContent = '📥 4G 收信中，120 秒后自动恢复原制式（可点按钮提前切回）';
							clearTimeout(autoBackTimer);
							callAutoBack('120');
							autoBackTimer = setTimeout(function() {
								notify('⏳ 收信窗口结束，后端已自动恢复原制式');
								setTimeout(function() { location.reload(); }, 3000);
							}, 120000);
							refreshSms();
						}).catch(function() {
							btnSmsMode.disabled = false;
							btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
							notify('❌ 切 4G 请求失败，请重试');
						});
					}
				}
			}, [ is4gMode ? '切回 5G 上网' : '切换 4G 收信' ]);
			if (is4gMode)
				smsModeHint.textContent = '📥 当前 4G（可收发短信），收完点按钮切回原制式或等待自动恢复';
			const smsSection = E('details', { 'class': 'cbi-section' }, [
				E('summary', { 'style': 'cursor:pointer;font-weight:bold' }, [ '📩 短信功能（点击展开：收信模式 / 发送 / 收件箱）' ]),
				E('div', { 'style': 'margin-top:8px' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '收信模式' ]),
						E('div', { 'class': 'cbi-value-field' }, [ E('div', { 'style': rowFlex }, [ btnSmsMode, smsModeHint ]) ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '发送短信' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': rowFlex }, [ numInput, btnSmsSend ]),
							E('div', { 'style': 'margin-top:6px' }, [ textInput ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '收件箱' ]),
						E('div', { 'class': 'cbi-value-field' }, [ E('div', { 'style': rowFlex }, [ btnSmsRefresh, smsStatus ]) ])
					]),
					smsTableWrap
				])
			]);
			let smsLoaded = false;
			smsSection.addEventListener('toggle', function() {
				if (smsSection.open && !smsLoaded) {
					smsLoaded = true;
					refreshSms();
				}
			});

			// ===== 数据用量 + SIM 详情（异步填充）=====
			const usageNode = E('span', {}, [ '…' ]);
			callUsage().then(function(r) {
				usageNode.textContent = r.ok ? ('↓' + r.rx + ' ↑' + r.tx + '，共 ' + r.total) : '—';
			});
			const simIccidNode = E('span', {}, [ '…' ]);
			const simImsiNode = E('span', {}, [ '…' ]);
			callSimInfo().then(function(r) {
				dom.content(simIccidNode, maskedNode(r.iccid));
				dom.content(simImsiNode, maskedNode(r.imsi));
			});
			const tempNode = E('span', {}, [ '…' ]);
			callTemp().then(function(r) {
				tempNode.textContent = r.ok ? (r.tsens + '°C') : '—';
			});
			// v4：适配层信息（module_profile 异步）
			const adapterNode = E('span', {}, [ '…' ]);
			callModuleProfile().then(function(r) {
				adapterNode.textContent = (r && r.adapter) ? r.adapter : '—';
			});
			// v4：本月流量（traffic_stats 异步）
			const monthNode = E('span', {}, [ '…' ]);
			function fmtTraffic(v) {
				if (v >= 1073741824) return (v / 1073741824.0).toFixed(2) + ' GB';
				if (v >= 1048576) return (v / 1048576.0).toFixed(1) + ' MB';
				if (v >= 1024) return Math.round(v / 1024.0) + ' KB';
				return v + ' B';
			}
			callTrafficStats().then(function(r) {
				if (r && r.days && r.days.length)
					monthNode.textContent = (r.month_total !== undefined ? ('本月 ' + fmtTraffic(r.month_total) + ' · ') : '') + '今日 ' + fmtTraffic(r.days[r.days.length - 1].total || 0);
				else
					monthNode.textContent = '统计中…（守护进程每分钟快照）';
			});

			// ===== P6 局部刷新（仅重拉 status，不整页 reload）=====
			const updatableNodes = { state: stateBadge, sig: sigNode5g, lte: sigNodeLte };
			const arKey = 'm5g-autorefresh';
			let arTimer = null;
			const autoChk = E('input', { 'type': 'checkbox', 'id': 'm5g-autorefresh' });
			autoChk.checked = window.localStorage.getItem(arKey) !== '0';   // 默认开启
			const startAr = function() {
				if (arTimer) clearInterval(arTimer);
				arTimer = setInterval(function() {
					callStatus().then(function(s2) {
						if (!s2 || !s2.model) return;
						const ok2 = okStates.indexOf(s2.state) > -1;
						updatableNodes.state.textContent = cn(STATE_CN, s2.state) || '未知';
						updatableNodes.state.className = 'cbi-status-' + (ok2 ? 'ok' : 'failed');
						updatableNodes.sig.firstChild.textContent = s2.signal_5g_rsrp && s2.signal_5g_rsrp !== '--'
							? ('RSRP ' + s2.signal_5g_rsrp + ' dBm / SINR ' + s2.signal_5g_snr + ' dB') : '—';
						updatableNodes.lte.firstChild.textContent = s2.signal_lte_rsrp && s2.signal_lte_rsrp !== '--'
							? ('RSRP ' + s2.signal_lte_rsrp + ' dBm / SINR ' + s2.signal_lte_snr + ' dB') : '—';
					});
				}, 30000);
			};
			autoChk.addEventListener('change', function() {
				if (autoChk.checked) {
					window.localStorage.setItem(arKey, '1');
					startAr();
					notify('已开启自动刷新（每 30 秒局部更新状态）');
				} else {
					window.localStorage.setItem(arKey, '0');
					clearInterval(arTimer);
					arTimer = null;
				}
			});
			if (autoChk.checked) startAr();

			// ===== 趋势区（保留）=====
			const rsrpDiv = E('div', {});
			const snrDiv = E('div', {});
			const tempDiv = E('div', {});
			const rateDiv = E('div', {});
			const speedNode = E('span', {}, [ '…' ]);
			const updateSpeed = function(points) {
				const rates = trendRate(points);
				if (rates.length) {
					const last = rates[rates.length - 1].rate;
					speedNode.textContent = '合计 ' + last.toFixed(2) + ' Mbps（60s 均值）';
				} else {
					speedNode.textContent = '—';
				}
			};
			callTrend('120').then(function(r) {
				if (r && r.points && r.points.length) {
					rsrpDiv.innerHTML = trendSvg(r.points, 'rsrp', -130, -60, '#e67e22', '5G RSRP', ' dBm');
					snrDiv.innerHTML = trendSvg(r.points, 'snr', 0, 25, '#2980b9', 'SINR', ' dB');
					tempDiv.innerHTML = trendSvg(r.points, 'tsens', 30, 90, '#e74c3c', '温度', '°C');
					rateDiv.innerHTML = trendSvg(trendRate(r.points), 'rate', 0, 50, '#27ae60', '实时速率', ' Mbps');
					updateSpeed(r.points);
				} else {
					rsrpDiv.textContent = '数据采集中…';
				}
			});

			// ===== v4：信号硬核指标（deep_signal）=====
			const hardSigRows = [
				[ '接入制式', '…' ], [ '支持频段（5G）', '…' ], [ '5G RSRP / RSRQ / SINR', '…' ],
				[ 'LTE RSRP / SINR', '…' ], [ '今日 RSRP 最低/最高/平均', '…' ], [ '今日温度 最低/最高/平均', '…' ]
			];
			const hardSigTable = section('信号硬核指标（今日统计）', hardSigRows);
			callDeepSignal().then(function(r) {
				if (!r) return;
				const cells = hardSigTable.querySelectorAll('td');
				if (!cells || cells.length < 12) return;
				cells[1].textContent = cn(TECH_CN, r.tech) || r.tech || '—';
				cells[3].textContent = (r.bands || []).slice(0, 8).map(function(b) { return String(b).replace(/^ngran-/, 'n').replace(/^eutran-/, 'B'); }).join(', ') + ((r.bands || []).length > 8 ? ' 等 ' + r.bands.length + ' 个' : '') || '—';
				cells[5].textContent = (r.signal_5g && r.signal_5g.rsrp) ? (r.signal_5g.rsrp + ' / ' + ((r.signal_5g.rsrq && r.signal_5g.rsrq !== '--') ? r.signal_5g.rsrq : 'N/A（未上报）') + ' / ' + r.signal_5g.snr + ' dB') : '—';
				cells[7].textContent = (r.signal_lte && r.signal_lte.rsrp) ? (r.signal_lte.rsrp + ' / ' + r.signal_lte.snr + ' dB') : '—';
				cells[9].textContent = (r.today_rsrp && r.today_rsrp.min !== '--') ? (r.today_rsrp.min + ' / ' + r.today_rsrp.max + ' / ' + r.today_rsrp.avg + ' dBm') : '数据采集中…';
				cells[11].textContent = (r.today_tsens && r.today_tsens.min !== '--') ? (r.today_tsens.min + ' / ' + r.today_tsens.max + ' / ' + r.today_tsens.avg + ' °C') : '数据采集中…';
			});

			// ===== 组装（P9 更新时间置顶）=====
			// 窄屏单栏：≤720px 时状态/信息/数据面三卡纵向堆叠
			if (!document.getElementById('m5g-media-css')) {
				const st = document.createElement('style');
				st.id = 'm5g-media-css';
				st.textContent = '@media (max-width:720px){ #m5g-status-grid{ grid-template-columns:1fr !important; } }';
				document.head.appendChild(st);
			}
			const tsLine = E('p', { 'class': 'cbi-section-descr' },
				[ '数据更新于 ' + new Date(info.ts * 1000).toLocaleTimeString(),
					E('span', { 'style': 'margin-left:16px' }, [ autoChk, ' 自动刷新（30 秒，局部更新）' ]) ]);
			function shortModel(m) { return m && m.length > 22 ? m.slice(0, 22) + '…' : (m || '未知模组'); }

			return E('div', {}, [
				E('h2', {}, [ '5G 模块状态', E('em', {}, [ ' · ' + shortModel(info.model) ]) ]),
				bannerBox,
				E('div', { 'id': 'm5g-status-grid', 'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;align-items:start' }, [
					section('连接状态', [
						[ '模块状态', stateBadge ],
						[ '接入技术', cn(TECH_CN, info.access_tech) || '—' ],
						[ '信号强度', has5gSig ? (sig + '（RSRP ' + info.signal_5g_rsrp + ' dBm）') : sig ],
						[ '5G 载波信号', sigNode5g ],
						[ 'LTE 锚点信号', sigNodeLte ],
						[ '运营商', (cn(OP_CN, info.operator_name) || info.operator_name || '—') + (info.operator_id ? ' (' + info.operator_id + ')' : '') ],
						[ '注册状态', cn(REG_CN, info.registration) || '—' ],
						[ '数据连接', cn(PACKET_CN, info.packet_state) || '—' ]
					]),
					section('模块信息', [
						[ '厂商', cn(MFG_CN, info.manufacturer) || '—' ],
						[ '型号', info.model ],
						[ '固件版本', info.firmware ],
						[ 'IMEI（点击显示）', maskedNode(info.imei) ],
						[ 'SIM 卡号 ICCID', simIccidNode ],
						[ 'SIM 识别码 IMSI', simImsiNode ],
						[ '模块温度', tempNode ],
						[ '适配层', adapterNode ]
					]),
					section('数据面', [
						[ 'IPv4', info.wwan0_ipv4 ],
						[ 'IPv6', info.wwan0_ipv6 ],
						[ '本次会话流量', usageNode ],
						[ '实时速率', speedNode ],
						[ '月度流量', monthNode ]
					])
				]),
				hardSigTable,
				tsLine,
				cfgSection,
				ctrlSection,
				diagSection,
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ '信号 / 温度 / 速率趋势（最近 2 小时，每分钟采样）' ]),
					E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:12px' }, [
						E('div', {}, [ rsrpDiv ]),
						E('div', {}, [ snrDiv ]),
						E('div', {}, [ tempDiv ]),
						E('div', {}, [ rateDiv ])
					])
				]),
				smsSection,
				E('p', { 'class': 'cbi-section-descr' }, [ '提示：危险操作（禁用/复位）会中断 5G；短信收发需切 4G，发送后自动恢复原制式。' ])
			]);
		});
	}
});
