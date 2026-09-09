'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

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

// 制式选项（单制式只支持 preferred: none，带 preferred 的必须是组合制式）
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
			const sigNode = E('span', {}, [ sig ]);
			const sig5gNode = E('span', {}, [
				has5gSig ? E('small', {}, [ 'RSRP ' + info.signal_5g_rsrp + ' dBm / SINR ' + info.signal_5g_snr + ' dB' ]) : '—'
			]);
			const sigLteNode = E('span', {}, [
				hasLteSig ? E('small', {}, [ 'RSRP ' + info.signal_lte_rsrp + ' dBm / SINR ' + info.signal_lte_snr + ' dB' ]) : '—'
			]);

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
					callRedial().then(function(r) {
						btnRedial.disabled = false;
						btnRedial.firstChild.nodeValue = '重拨数据面';
						notify(r.ok ? '✅ 重拨成功，新 IP：' + (r.ipv4 || '') : '⏳ ' + (r.detail || '重拨进行中'));
						location.reload();
					});
				}
			}, [ '重拨数据面' ]);

			// --- 网络制式下拉 + 应用 ---
			const selMode = E('select', { 'class': 'cbi-input-select' });
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
						if (r.ok) location.reload();
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
						location.reload();
					});
				}
			}, [ '启用模块' ]);
			let dArm = false, dTimer = null;
			const btnDisable = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					if (!dArm) {
						dArm = true;
						btnDisable.classList.add('cbi-button-negative');
						btnDisable.firstChild.nodeValue = '再次点击确认禁用';
						notify('⚠️ 禁用会断开 5G，再次点击确认');
						dTimer = setTimeout(function() {
							dArm = false;
							btnDisable.classList.remove('cbi-button-negative');
							btnDisable.firstChild.nodeValue = '禁用模块';
						}, 4000);
						return;
					}
					clearTimeout(dTimer);
					dArm = false;
					btnDisable.disabled = true;
					btnDisable.firstChild.nodeValue = '禁用中…';
					callDisable().then(function(r) {
						btnDisable.disabled = false;
						btnDisable.firstChild.nodeValue = '禁用模块';
						notify(r.ok ? '✅ 模块已禁用' : '❌ ' + (r.detail || '禁用失败'));
						location.reload();
					});
				}
			}, [ '禁用模块' ]);
			const moduleBtns = moduleDisabled ? [ btnEnable ] : [ btnDisable ];

			// --- 模块复位（两次点击确认） ---
			let rArm = false, rTimer = null;
			const btnReset = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					if (!rArm) {
						rArm = true;
						btnReset.classList.add('cbi-button-negative');
						btnReset.firstChild.nodeValue = '再次点击确认复位';
						notify('⚠️ 模块复位将断开 5G 约 30-60 秒，再次点击确认');
						rTimer = setTimeout(function() {
							rArm = false;
							btnReset.classList.remove('cbi-button-negative');
							btnReset.firstChild.nodeValue = '复位模块';
						}, 4000);
						return;
					}
					clearTimeout(rTimer);
					rArm = false;
					btnReset.disabled = true;
					btnReset.firstChild.nodeValue = '复位中…';
					callReset().then(function(r) {
						btnReset.disabled = false;
						btnReset.firstChild.nodeValue = '复位模块';
						notify(r.ok ? '✅ ' + (r.detail || '复位命令已发送') : '❌ ' + (r.detail || '复位失败'));
						if (r.ok) setTimeout(function() { location.reload(); }, 60000);
					});
				}
			}, [ '复位模块' ]);

			// --- 频段锁定（预设组合） ---
			const all5g = (info.ngran_bands || []).join('|');
			const BAND_OPTS = [
				{ label: '全频段（自动）', bands: 'any' },
				{ label: '仅 5G（全部 n 频段）', bands: all5g },
				{ label: '移动 5G（n28+n41+n79）', bands: 'ngran-28|ngran-41|ngran-79' },
				{ label: '电信/联通 5G（n78）', bands: 'ngran-78' },
				{ label: '移动 4G（B3+B8+B34+B39+B40+B41）', bands: 'eutran-3|eutran-8|eutran-34|eutran-39|eutran-40|eutran-41' }
			];
			const bandSel = E('select', { 'id': 'm5g-sel-bands', 'class': 'cbi-input-select' });
			BAND_OPTS.forEach(function(o, i) {
				bandSel.appendChild(E('option', { 'value': String(i) }, [ o.label ]));
			});
			const nBands = (info.cur_bands || []).length;
			const btnBands = E('button', {
				'id': 'm5g-btn-bands',
				'class': 'btn cbi-button-action',
				'click': function() {
					const o = BAND_OPTS[parseInt(bandSel.value)];
					btnBands.disabled = true;
					btnBands.firstChild.nodeValue = '应用中…';
					callSetBands(o.bands).then(function(r) {
						btnBands.disabled = false;
						btnBands.firstChild.nodeValue = '应用';
						notify(r.ok ? '✅ ' + (r.detail || '频段已设置') : '❌ ' + (r.error || r.detail || '设置失败'));
						if (r.ok) location.reload();
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
						clearInterval(scanTimer);
						scanTimer = setInterval(pollScan, 6000);
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

			// --- APN 表单 ---
			const apnInput = E('input', {
				'class': 'cbi-input-text',
				'style': 'width:220px',
				'placeholder': 'APN，如 cmnet',
				'value': info.cfg_apn || ''
			});
			const userInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:130px', 'placeholder': '用户名（可选）' });
			const passInput = E('input', { 'class': 'cbi-input-text', 'type': 'password', 'style': 'width:130px', 'placeholder': '密码（可选）' });
			const btnSave = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					const apn = apnInput.value.trim();
					if (!apn) { notify('⚠️ 请填写 APN'); return; }
					btnSave.disabled = true;
					btnSave.firstChild.nodeValue = '保存中…';
					callSetApn(apn, userInput.value.trim(), passInput.value).then(function(r) {
						btnSave.disabled = false;
						btnSave.firstChild.nodeValue = '保存并重拨';
						notify(r.ok ? '✅ ' + (r.detail || 'APN 已更新') : '❌ ' + (r.error || '保存失败'));
						location.reload();
					});
				}
			}, [ '保存并重拨' ]);

			// --- 网络诊断 Ping ---
			const pingInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:150px', 'value': '223.5.5.5', 'placeholder': '目标 IP 或域名' });
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
					});
				}
			}, [ '测试' ]);

			// --- USSD 查询（余额/套餐；T99W368 模块可能不支持） ---
			const ussdInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:150px', 'value': '*100#', 'placeholder': 'USSD 码如 *100#' });
			const ussdResult = E('span', { 'class': 'cbi-section-descr' }, []);
			const btnUssd = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					const code = ussdInput.value.trim();
					if (!code) { notify('⚠️ 请输入 USSD 码'); return; }
					btnUssd.disabled = true;
					btnUssd.firstChild.nodeValue = '查询中…';
					ussdResult.textContent = '';
					callUssd(code).then(function(r) {
						btnUssd.disabled = false;
						btnUssd.firstChild.nodeValue = '查询';
						ussdResult.textContent = r.ok ? ('结果：' + (r.result || '已发起')) : '失败：' + (r.detail || '模块可能不支持 USSD');
						notify(r.ok ? '✅ ' + (r.result || 'USSD 已发起') : '❌ ' + (r.detail || '查询失败'));
					});
				}
			}, [ '查询' ]);

			// --- AT 查询（ADB 通道，预设只读指令） ---
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
			const atSel = E('select', { 'id': 'm5g-sel-at', 'class': 'cbi-input-select' });
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
					});
				}
			}, [ '执行' ]);

			// 看门狗状态（异步加载；定义须在 ctrlSection 之前，因其被引用）
			const watchdogNode = E('span', {}, [ '…' ]);
			callWatchdog().then(function(r) {
				const firstLog = (r.recent && r.recent !== '暂无重拨记录') ? r.recent.split('\n')[0] : '';
				watchdogNode.textContent = (r.running ? '✅ 运行中' : '⚠️ 未运行') + (firstLog ? '（最近自动重拨：' + firstLog + '）' : '');
			});

			const ctrlSection = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ '控制操作' ]),
				E('div', { 'class': 'cbi-map' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '数据面' ]),
						E('div', { 'class': 'cbi-value-field' }, [ btnRedial ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络制式' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('span', {}, [ '当前：' + (info.cur_allowed || '—') + '（优先 ' + (info.cur_preferred || '—') + '）' ]),
							E('div', { 'style': 'display:flex;gap:8px;margin-top:6px' }, [ selMode, btnMode ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '频段锁定' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('span', {}, [ '当前启用 ' + nBands + ' 个频段' ]),
							E('div', { 'style': 'display:flex;gap:8px;margin-top:6px' }, [ bandSel, btnBands ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '模块电源' ]),
						E('div', { 'class': 'cbi-value-field' }, moduleBtns.concat([ btnReset ]))
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络扫描' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							btnScan, ' ', scanStatusText
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'APN 参数' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap' }, [ apnInput, userInput, passInput, btnSave ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '网络诊断' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [ pingInput, btnPing ]),
							E('div', { 'style': 'margin-top:6px' }, [ pingResult ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'USSD 查询' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [ ussdInput, btnUssd ]),
							E('div', { 'style': 'margin-top:6px' }, [ ussdResult ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '数据面看门狗' ]),
						E('div', { 'class': 'cbi-value-field' }, [ watchdogNode ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ 'AT 查询' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [ atSel, btnAt ]),
							E('pre', { 'class': 'm5g-at-out', 'style': 'white-space:pre-wrap;background:#f5f5f5;border:1px solid #ddd;padding:8px;margin-top:6px;max-height:200px;overflow-y:auto;min-width:100%;box-sizing:border-box' }, [ atResult ])
						])
					])
				]),
				scanTable,
				E('div', { 'class': 'cbi-section-descr' },
					[ '重拨/切制式/禁用会短暂断开数据面；管理走有线 LAN 不受影响。' ])
			]);

			// ===== 短信区 =====
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
							});
						}
					}, [ '删除' ]);
					// 内容默认折叠：显示摘要，点击展开/收起全文
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
				'class': 'cbi-input-text', 'style': 'width:220px',
				'placeholder': '接收号码，如 13800138000'
			});
			const textInput = E('textarea', {
				'class': 'cbi-input-text', 'style': 'width:100%;height:64px;box-sizing:border-box',
				'placeholder': '短信内容（≤500 字符，支持中文/长短信自动分片）'
			});
			// 发送短信：5G 下自动切 4G → 发送 → 自动切回 5G
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
							// 若为自动切 4G 发送，2 秒后自动切回 5G
							if (!in4g) {
								notify('⏳ 发送完成，2 秒后自动切回 5G');
								setTimeout(function() { callSetMode('3g|4g|5g', '5g'); }, 2000);
							}
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
							notify('📥 已切 4G，10 秒后自动发送…');
							setTimeout(doSend, 10000);
						});
					}
				}
			}, [ '发送短信' ]);
			const btnSmsRefresh = E('button', { 'class': 'btn', 'click': refreshSms }, [ '刷新' ]);
			// 收信模式：切 4G 收信，120 秒后自动切回 5G；可手动提前切回
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
						// 手动切回 5G
						clearTimeout(autoBackTimer);
						callSetMode('3g|4g|5g', '5g').then(function(r) {
							btnSmsMode.disabled = false;
							btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
							notify(r.ok ? '✅ 已切回 5G 上网' : '❌ ' + (r.error || '切换失败'));
							location.reload();
						});
					} else {
						// 切 4G 收信 + 120s 自动回 5G
						callSetMode('4g', '').then(function(r) {
							btnSmsMode.disabled = false;
							if (!r.ok) {
								btnSmsMode.firstChild.nodeValue = '切换 4G 收信';
								notify('❌ ' + (r.error || r.detail || '切换失败'));
								return;
							}
							btnSmsMode.firstChild.nodeValue = '切回 5G 上网';
							smsModeHint.textContent = '📥 4G 收信中，120 秒后自动切回 5G（可点按钮提前切回）';
							clearTimeout(autoBackTimer);
							callAutoBack('120');  // 后端兜底（关页面也会自动回 5G）
							autoBackTimer = setTimeout(function() {
								notify('⏳ 收信窗口结束，自动切回 5G');
								callSetMode('3g|4g|5g', '5g');
								setTimeout(function() { location.reload(); }, 15000);
							}, 120000);
							refreshSms();
						});
					}
				}
			}, [ is4gMode ? '切回 5G 上网' : '切换 4G 收信' ]);
			if (is4gMode)
				smsModeHint.textContent = '📥 当前 4G（可收发短信），收完点按钮切回 5G 或等待自动切换';
			// 短信区：默认折叠隐藏（防止短信内容/号码泄露，点击标题展开）
			const smsSection = E('details', { 'class': 'cbi-section' }, [
				E('summary', { 'style': 'cursor:pointer;font-weight:bold' }, [ '📩 短信功能（点击展开：收信模式 / 发送 / 收件箱）' ]),
				E('div', { 'style': 'margin-top:8px' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '收信模式' ]),
						E('div', { 'class': 'cbi-value-field' }, [ btnSmsMode, ' ', smsModeHint ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '发送短信' ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [ numInput, btnSmsSend ]),
							E('div', { 'style': 'margin-top:6px' }, [ textInput ])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ '收件箱' ]),
						E('div', { 'class': 'cbi-value-field' }, [ btnSmsRefresh, ' ', smsStatus ])
					]),
					smsTableWrap
				])
			]);
			// 懒加载：首次展开短信区才拉取收件箱（默认折叠时 DOM 无短信数据，防泄露）
			let smsLoaded = false;
			smsSection.addEventListener('toggle', function() {
				if (smsSection.open && !smsLoaded) {
					smsLoaded = true;
					refreshSms();
				}
			});

			// 数据用量 + SIM 详情（异步加载填充）
			const usageNode = E('span', {}, [ '…' ]);
			callUsage().then(function(r) {
				usageNode.textContent = r.ok ? ('↓' + r.rx + ' ↑' + r.tx + '，共 ' + r.total) : '—';
			});
			const simIccidNode = E('span', {}, [ '…' ]);
			const simImsiNode = E('span', {}, [ '…' ]);
			callSimInfo().then(function(r) {
				simIccidNode.textContent = r.iccid || '—';
				simImsiNode.textContent = r.imsi || '—';
			});
			const tempNode = E('span', {}, [ '…' ]);
			callTemp().then(function(r) {
				tempNode.textContent = r.ok ? (r.tsens + '°C') : '—';
			});
			// 自动刷新开关（30 秒）
			const autoChk = E('input', { 'type': 'checkbox', 'id': 'm5g-autorefresh' });
			let arTimer = null;
			autoChk.addEventListener('change', function() {
				if (autoChk.checked) {
					notify('已开启自动刷新（每 30 秒自动刷新页面数据）');
					arTimer = setInterval(function() { location.reload(); }, 30000);
				} else {
					clearInterval(arTimer);
				}
			});

			return E('div', {}, [
				E('h2', {}, [ '5G 模块状态', E('em', {}, [ ' · T99W368 (SDX65)' ]) ]),
				// 信息区三卡并排（窄屏自动换行）
				E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;align-items:start' }, [
					section('连接状态', [
						[ '模块状态', stateBadge ],
						[ '接入技术', cn(TECH_CN, info.access_tech) || '—' ],
						[ '信号强度', sigNode ],
						[ '5G 载波信号', sig5gNode ],
						[ 'LTE 锚点信号', sigLteNode ],
						[ '运营商', (cn(OP_CN, info.operator_name) || info.operator_name || '—') + (info.operator_id ? ' (' + info.operator_id + ')' : '') ],
						[ '注册状态', cn(REG_CN, info.registration) || '—' ],
						[ '数据连接', cn(PACKET_CN, info.packet_state) || '—' ]
					]),
					section('模块信息', [
						[ '厂商', cn(MFG_CN, info.manufacturer) || '—' ],
						[ '型号', info.model ],
						[ '固件版本', info.firmware ],
						[ 'IMEI', info.imei ],
						[ 'SIM 卡号 ICCID', simIccidNode ],
						[ 'SIM 识别码 IMSI', simImsiNode ],
						[ '模块温度', tempNode ]
					]),
					section('数据面', [
						[ 'IPv4', info.wwan0_ipv4 ],
						[ 'IPv6', info.wwan0_ipv6 ],
						[ '本次会话流量', usageNode ],
						[ '主端口', info.primary_port ],
						[ '端口布局', info.ports ]
					])
				]),
				ctrlSection,
				smsSection,
				E('p', { 'class': 'cbi-section-descr' },
					[ '数据更新于 ' + new Date(info.ts * 1000).toLocaleTimeString() ]),
				E('p', { 'class': 'cbi-section-descr' }, [ autoChk, ' 自动刷新（30 秒）' ])
			]);
		});
	}
});
