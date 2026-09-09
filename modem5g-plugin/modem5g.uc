"use strict";

import { popen, writefile } from 'fs';

// 执行命令并返回输出
const exec = (cmd) => {
	let fd = popen(cmd, "r");
	if (!fd)
		return "";
	let out = fd.read("all");
	fd.close();
	return out || "";
};

function firstMatch(text, re) {
	let m = match(text, re);
	return m ? m[1] : "";
}

// 动态获取当前 Modem 索引（热插拔/重枚举后编号会递增）
function getModemIndex() {
	const L = exec("mmcli -L");
	return firstMatch(L, /Modem\/(\d+)/) || "";
}

// 同步 uci device 到当前索引（重拨前校准，防止 device 失配导致 proto 找不到 modem）
function syncDeviceIndex(idx) {
	if (!idx)
		return;
	const cur = trim(exec("uci get network.wwan.device 2>/dev/null"));
	if (cur != idx) {
		exec("uci set network.wwan.device='" + idx + "'");
		exec("uci commit network");
	}
}

// mmcli --output-json 结构化状态（无 ANSI 颜色码，比表格解析稳）
function mmStatus(idx) {
	let out = exec("mmcli -m " + idx + " --output-json 2>&1");
	let j = null;
	try {
		j = json(out);
	} catch (e) {
		j = null;
	}
	if (!j || !j.modem)
		return {};
	const g = j.modem.generic || {};
	const p = j.modem["3gpp"] || {};
	// 支持的制式组合列表（供前端下拉）
	const supported = [];
	for (let s in (g["supported-modes"] || [])) {
		let m = match(s, /allowed:\s*([^;]+);\s*preferred:\s*(\S+)/);
		if (m)
			push(supported, { allowed: trim(m[1]), preferred: trim(m[2]) });
	}
	// 当前制式 "allowed: 3g, 4g, 5g; preferred: 5g"
	let curAllowed = "", curPreferred = "";
	let cm = match(g["current-modes"] || "", /allowed:\s*([^;]+);\s*preferred:\s*(\S+)/);
	if (cm) {
		curAllowed = trim(cm[1]);
		curPreferred = trim(cm[2]);
	}
	// 扩展信号（RSRP/RSRQ/SINR，MM 原生 MBIM signal 扩展，无需 AT 口）
	let sig5g = {}, sigLte = {};
	const sigOut = exec("mmcli -m " + idx + " --signal-setup=3 >/dev/null 2>&1; mmcli -m " + idx + " --signal-get --output-json 2>&1");
	try {
		const sj = json(sigOut);
		const ss = sj && sj.modem && sj.modem.signal ? sj.modem.signal : {};
		sig5g = ss["5g"] || {};
		sigLte = ss["lte"] || {};
	} catch (e) {
		sig5g = {};
		sigLte = {};
	}
	// 5G 频段列表（ngran-*，供前端展示/锁频段）
	const ngran = [];
	for (let b in (g["supported-bands"] || []))
		if (match(b, /^ngran-/))
			push(ngran, b);
	return {
		modem_index: idx,
		modem_path: j.modem["dbus-path"] || "",
		manufacturer: g["manufacturer"] || "",
		model: g["model"] || "",
		firmware: trim(g["revision"] || ""),
		imei: g["equipment-identifier"] || "",
		state: g["state"] || "",
		power_state: g["power-state"] || "",
		access_tech: (g["access-technologies"] || [])[0] || "",
		signal: (g["signal-quality"] || {})["value"] || "",
		operator_name: p["operator-name"] || "",
		operator_id: p["operator-code"] || "",
		registration: p["registration-state"] || "",
		packet_state: p["packet-service-state"] || "",
		primary_port: g["primary-port"] || "",
		ports: join(g["ports"] || [], ", "),
		cur_bands: g["current-bands"] || [],
		ngran_bands: ngran,
		cur_allowed: curAllowed,
		cur_preferred: curPreferred,
		supported_modes: supported,
		signal_5g_rsrp: sig5g["rsrp"] || "",
		signal_5g_rsrq: sig5g["rsrq"] || "",
		signal_5g_snr: sig5g["snr"] || "",
		signal_lte_rsrp: sigLte["rsrp"] || "",
		signal_lte_snr: sigLte["snr"] || ""
	};
}

// 重拨数据面（ifdown + sleep + ifup），最多等 ~30s，返回是否拿到 IP
function doRedial() {
	const idx = getModemIndex();
	syncDeviceIndex(idx);
	exec("ifdown wwan 2>/dev/null");
	exec("sleep 2");
	exec("ifup wwan 2>/dev/null");
	let ok = false, ip = "";
	for (let i = 0; i < 10; i++) {
		exec("sleep 3");
		ip = firstMatch(exec("ip addr show wwan0 2>/dev/null"), /inet\s+([0-9.]+)/);
		if (ip) {
			ok = true;
			break;
		}
	}
	return { ok: ok, modem_index: idx, ipv4: ip };
}

// 解析 3GPP 扫描输出
function parseScan(out) {
	const nets = [];
	for (let line in split(out, "\n")) {
		let m = match(line, /(\d{4,6})\s*-\s*([^(]+?)\s*\(([^)]*)\)/);
		if (m)
			push(nets, { mccmnc: trim(m[1]), name: trim(m[2]), status: trim(m[3]) });
	}
	return nets;
}

// 当前扫描状态（idle/running/done）——用 PID 文件判断，避免 pgrep 自匹配误报
function scanState() {
	const pid = trim(exec("cat /tmp/m5g-scan.pid 2>/dev/null"));
	if (pid) {
		const alive = exec("kill -0 " + pid + " 2>/dev/null && echo 1");
		if (alive)
			return { state: "running" };
	}
	const out = exec("cat /tmp/m5g-scan.out 2>/dev/null");
	if (out && match(out, /3GPP scan/))
		return { state: "done", networks: parseScan(out), raw: out };
	return { state: "idle" };
}

const methods = {
	// 只读：5G 模块整体状态
	status: {
		call: function(request) {
			const idx = getModemIndex() || "0";
			const info = mmStatus(idx);
			const wwan = exec("ip addr show wwan0 2>/dev/null");
			const sc = scanState();
			return {
				modem_index: idx,
				modem_path: info["modem_path"],
				manufacturer: info["manufacturer"],
				model: info["model"],
				firmware: info["firmware"],
				imei: info["imei"],
				state: info["state"],
				power_state: info["power_state"],
				access_tech: info["access_tech"],
				signal: info["signal"],
				operator_name: info["operator_name"],
				operator_id: info["operator_id"],
				registration: info["registration"],
				packet_state: info["packet_state"],
				primary_port: info["primary_port"],
				ports: info["ports"],
				cur_bands: info["cur_bands"],
				ngran_bands: info["ngran_bands"],
				cur_allowed: info["cur_allowed"],
				cur_preferred: info["cur_preferred"],
				supported_modes: info["supported_modes"],
				signal_5g_rsrp: info["signal_5g_rsrp"],
				signal_5g_rsrq: info["signal_5g_rsrq"],
				signal_5g_snr: info["signal_5g_snr"],
				signal_lte_rsrp: info["signal_lte_rsrp"],
				signal_lte_snr: info["signal_lte_snr"],
				wwan0_ipv4: firstMatch(wwan, /inet\s+([0-9.]+)/) || "",
				wwan0_ipv6: firstMatch(wwan, /inet6\s+([0-9a-f:]+)/) || "",
				cfg_device: trim(exec("uci get network.wwan.device 2>/dev/null")),
				cfg_apn: trim(exec("uci get network.wwan.apn 2>/dev/null")),
				scan_state: sc.state,
				scan_networks: sc.networks || [],
				ts: time()
			};
		}
	},
	// 只读：modem 列表
	list: {
		call: function() {
			const L = exec("mmcli -L");
			const modems = [];
			for (let line in split(L, "\n")) {
				let m = match(line, /Modem\/(\d+)\s*\[([^\]]*)\]/);
				if (m)
					push(modems, { index: m[1], name: trim(m[2]) });
			}
			return { modems: modems, raw: L };
		}
	},
	// 控制：重拨数据面
	redial: {
		call: function(request) {
			const r = doRedial();
			return { ok: r.ok, modem_index: r.modem_index, ipv4: r.ipv4,
				detail: r.ok ? "拨号成功" : "拨号尚未完成(最长约30s),可稍后刷新状态" };
		}
	},
	// 控制：修改 APN 拨号参数并重拨（白名单校验 + 备份可回滚）
	set_apn: {
		args: { apn: "", user: "", password: "" },
		call: function(request) {
			const apn = trim(request.args.apn || "");
			if (!match(apn, /^[A-Za-z0-9.+-]{1,63}$/))
				return { ok: false, error: "APN 格式非法(仅字母数字.+-)" };
			const user = trim(request.args.user || "");
			const pass = trim(request.args.password || "");
			if (user && !match(user, /^[A-Za-z0-9.@_-]{0,63}$/))
				return { ok: false, error: "用户名格式非法" };
			exec("cp /etc/config/network /tmp/network.bak.m5g");
			exec("uci set network.wwan.apn='" + apn + "'");
			if (user)
				exec("uci set network.wwan.username='" + user + "'");
			else
				exec("uci delete network.wwan.username 2>/dev/null");
			if (pass)
				exec("uci set network.wwan.password='" + pass + "'");
			else
				exec("uci delete network.wwan.password 2>/dev/null");
			exec("uci commit network");
			const r = doRedial();
			return { ok: r.ok, apn: apn, ipv4: r.ipv4,
				detail: r.ok ? "APN 已更新并重拨成功" : "APN 已保存,重拨进行中" };
		}
	},
	// 控制：切换网络制式（MM 标准 API，非 USB 切换，安全）
	set_mode: {
		args: { allowed: "", preferred: "" },
		call: function(request) {
			const allowed = trim(request.args.allowed || "");
			const preferred = trim(request.args.preferred || "");
			const valid = [ "2g", "3g", "4g", "5g", "any" ];
			if (!allowed)
				return { ok: false, error: "请选择制式组合" };
			// 白名单校验（手写循环；ucode 数组无 indexof/contains）
			let okList = true;
			for (let p in split(allowed, "|")) {
				let okv = false;
				for (let v in valid)
					if (v == trim(p)) okv = true;
				if (!okv) okList = false;
			}
			if (!okList)
				return { ok: false, error: "制式组合非法" };
			if (preferred) {
				let okp = false;
				for (let v in valid)
					if (v == preferred) okp = true;
				if (!okp)
					return { ok: false, error: "优先制式非法" };
			}
			const idx = getModemIndex();
			let cmd = "mmcli -m " + idx + " --set-allowed-modes=\"" + allowed + "\"";
			if (preferred)
				cmd += " --set-preferred-mode=\"" + preferred + "\"";
			const out = exec(cmd + " 2>&1");
			const ok = !!match(out, /successfully/);
			return { ok: ok, output: trim(out),
				detail: ok ? "网络制式已切换" : "切换失败: " + trim(out) };
		}
	},
	// 控制：启用模块
	enable: {
		call: function() {
			const idx = getModemIndex();
			const out = exec("mmcli -m " + idx + " -e 2>&1");
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "模块已启用" : "启用失败: " + trim(out) };
		}
	},
	// 控制：禁用模块（会断开数据面）
	disable: {
		call: function() {
			const idx = getModemIndex();
			const out = exec("mmcli -m " + idx + " -d 2>&1");
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "模块已禁用" : "禁用失败: " + trim(out) };
		}
	},
	// 控制：网络扫描（后台执行，约 60-90 秒；前端轮询 status 的 scan_state/scan_networks）
	scan: {
		call: function() {
			const st = scanState();
			if (st.state == "running")
				return { started: false, detail: "扫描进行中，请稍候" };
			const idx = getModemIndex();
			exec("sh /usr/bin/m5g-scan.sh " + idx + " >/dev/null 2>&1 &");
			return { started: true, detail: "扫描已启动，约 60-90 秒完成" };
		}
	},
	// 控制：模块软复位（复位后重枚举 30-60s，后台脚本自动校准 device 并重拨）
	reset: {
		call: function() {
			const idx = getModemIndex();
			const out = exec("mmcli -m " + idx + " -r 2>&1");
			const ok = !!match(out, /successfully/);
			if (ok)
				exec("sh /usr/bin/m5g-reset-restore.sh >/dev/null 2>&1 &");
			return { ok: ok, detail: ok ? "模块复位中，约 1 分钟自动恢复，期间 5G 不可用" : "复位失败: " + trim(out) };
		}
	},
	// 控制：锁频段（bands 用 | 分隔，如 "ngran-78|ngran-41"；"any" 恢复全部自动）
	set_bands: {
		args: { bands: "" },
		call: function(request) {
			const bands = trim(request.args.bands || "");
			if (!bands)
				return { ok: false, error: "请选择频段组合" };
			let okb = false;
			if (bands == "any") {
				okb = true;
			} else {
				okb = true;
				for (let b in split(bands, "|")) {
					if (!match(trim(b), /^(utran|eutran|ngran)-[0-9]{1,3}$/))
						okb = false;
				}
			}
			if (!okb)
				return { ok: false, error: "频段格式非法" };
			const idx = getModemIndex();
			const out = exec("mmcli -m " + idx + " --set-current-bands=\"" + bands + "\" 2>&1");
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "频段设置已应用" : "设置失败: " + trim(out) };
		}
	},
	// 只读：SIM 卡短信列表（含内容/号码/时间）
	sms_list: {
		call: function() {
			const idx = getModemIndex();
			const L = exec("mmcli -m " + idx + " --messaging-list-sms 2>&1");
			const smsPaths = [];
			for (let line in split(L, "\n")) {
				let m = match(line, /SMS\/(\d+)\s+\((\w+)\)/);
				if (m)
					push(smsPaths, { index: m[1], state: m[2] });
			}
			const list = [];
			for (let s in smsPaths) {
				const out = exec("mmcli -s " + s.index + " --output-json 2>&1");
				try {
					const j = json(out);
					const sms = j && j.sms ? j.sms : {};
					const cont = sms["content"] || {};
					const prop = sms["properties"] || {};
					push(list, {
						index: s.index,
						state: prop["state"] || s.state,
						number: cont["number"] || "",
						text: cont["text"] || "",
						timestamp: prop["timestamp"] || ""
					});
				} catch (e) {}
			}
			// 倒序：最新在前
			const rev = [];
			for (let i = length(list) - 1; i >= 0; i--)
				push(rev, list[i]);
			return { sms: rev };
		}
	},
	// 控制：发送短信（创建 + 发送；文件方式创建避免属性解析的空格/逗号坑）
	sms_send: {
		args: { number: "", text: "" },
		call: function(request) {
			const number = trim(request.args.number || "");
			const text = trim(request.args.text || "");
			if (!match(number, /^[0-9+]{3,20}$/))
				return { ok: false, error: "号码格式非法" };
			if (!text)
				return { ok: false, error: "短信内容为空" };
			if (length(text) > 500)
				return { ok: false, error: "短信内容过长(≤500字符)" };
			const idx = getModemIndex();
			// 文本写文件，用 --messaging-create-sms-with-text 创建：
			// 属性方式对空格(需 NBSP)和逗号(键值分隔符)都敏感，文件方式任意字符安全
			writefile("/tmp/m5g-sms.txt", text);
			const out = exec("mmcli -m " + idx + " --messaging-create-sms=\"number=" + number + "\" --messaging-create-sms-with-text=/tmp/m5g-sms.txt 2>&1");
			let m = match(out, /SMS\/(\d+)/);
			if (!m)
				return { ok: false, error: "创建短信失败: " + trim(out) };
			const sid = m[1];
			const sent = exec("mmcli -s " + sid + " --send 2>&1");
			const ok = !!match(sent, /successfully/);
			return { ok: ok, detail: ok ? "短信已发送" : "发送失败: " + trim(sent), sms_id: sid };
		}
	},
	// 控制：删除短信（index 为 SMS/N 的数字）
	sms_delete: {
		args: { index: "" },
		call: function(request) {
			const index = trim(request.args.index || "");
			if (!match(index, /^[0-9]{1,4}$/))
				return { ok: false, error: "索引非法" };
			const idx = getModemIndex();
			const out = exec("mmcli -m " + idx + " --messaging-delete-sms=" + index + " 2>&1");
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "短信已删除" : "删除失败: " + trim(out) };
		}
	},
	// 只读：数据用量（wwan0 接口计数器，会话级）
	usage: {
		call: function() {
			const dev = exec("cat /proc/net/dev 2>/dev/null | grep wwan0");
			const m = match(dev, /wwan0:\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
			if (!m)
				return { ok: false, rx: "0 B", tx: "0 B", total: "0 B", detail: "未获取到接口统计" };
			// ucode 无 float()：字符串 / 1 触发数值转换
			const rx = m[1] / 1, tx = m[2] / 1;
			const fmt = function(v) {
				if (v >= 1073741824) return sprintf("%.2f GB", v / 1073741824.0);
				if (v >= 1048576) return sprintf("%.1f MB", v / 1048576.0);
				if (v >= 1024) return sprintf("%.0f KB", v / 1024.0);
				return sprintf("%.0f B", v);
			};
			return { ok: true, rx_bytes: m[1], tx_bytes: m[2], total_bytes: sprintf("%.0f", rx + tx),
				rx: fmt(rx), tx: fmt(tx), total: fmt(rx + tx) };
		}
	},
	// 只读：SIM 卡详情（ICCID/IMSI/运营商）
	sim_info: {
		call: function() {
			const idx = getModemIndex();
			const out = exec("mmcli -i " + idx + " 2>&1");
			const g = function(re) {
				let m = match(out, re);
				return m ? trim(m[1]) : "";
			};
			return {
				iccid: g(/iccid:\s*(\S+)/),
				imsi: g(/imsi:\s*(\S+)/),
				operator_id: g(/operator id:\s*(\S+)/),
				operator_name: g(/operator name:\s*(.+)$/),
				active: g(/active:\s*(\S+)/)
			};
		}
	},
	// 控制：USSD 查询（如余额 *100#；5G 下可能不可用，需 4G 模式）
	ussd_query: {
		args: { code: "" },
		call: function(request) {
			const code = trim(request.args.code || "");
			if (!match(code, /^[*#0-9]{2,20}$/))
				return { ok: false, error: "USSD 码格式非法（如 *100#）" };
			const idx = getModemIndex();
			// 先取消可能残留的会话；timeout 限制总时长，避免挂起导致 rpc 超时
			const out = exec("mmcli -m " + idx + " --3gpp-ussd-cancel 2>/dev/null; timeout 8 mmcli -m " + idx + " --3gpp-ussd-initiate='" + code + "' 2>&1; sleep 1; timeout 5 mmcli -m " + idx + " --3gpp-ussd-status 2>&1");
			const ok = !!match(out, /successfully/);
			// 提取 USSD 结果文本（network-request / status 字段）
			let result = "";
			let m = match(out, /network-request:\s*'?([^'\n]+)/);
			if (m) result = trim(m[1]);
			if (!result) {
				m = match(out, /status:\s*(\w+)/);
				if (m) result = "会话状态: " + trim(m[1]);
			}
			return { ok: ok, result: result, raw: trim(out),
				detail: ok ? "USSD 已发起" : "查询失败(5G 下可能不可用，请先切 4G 收信模式): " + trim(out) };
		}
	},
	// 控制：网络诊断 Ping（4 次，返回延迟/丢包）
	ping_test: {
		args: { host: "" },
		call: function(request) {
			const host = trim(request.args.host || "");
			if (!match(host, /^[0-9.]{7,15}$/) && !match(host, /^[a-zA-Z0-9.-]{1,63}$/))
				return { ok: false, error: "目标格式非法" };
			const out = exec("ping -c 4 -W 2 " + host + " 2>&1");
			const stats = match(out, /(\d+) packets transmitted, (\d+) packets received, (\d+)% packet loss/);
			if (!stats)
				return { ok: false, error: "Ping 执行失败" };
			const rtt = match(out, /min\/avg\/max.*?=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)/);
			return {
				ok: true,
				sent: stats[1], recv: stats[2], loss: stats[3],
				min: rtt ? rtt[1] : "", avg: rtt ? rtt[2] : "", max: rtt ? rtt[3] : "",
				detail: stats[2] > 0 ? ("丢包 " + stats[3] + "%，平均延迟 " + (rtt ? rtt[2] : "—") + " ms")
					: "全部丢包（数据面可能未真正连通）"
			};
		}
	},
	// 只读：看门狗状态（运行中/最近重拨日志）
	watchdog_status: {
		call: function() {
			const pid = trim(exec("cat /tmp/m5g-watchdog.pid 2>/dev/null"));
			const alive = pid && trim(exec("kill -0 " + pid + " 2>/dev/null && echo 1"));
			const log = trim(exec("tail -5 /tmp/m5g-watchdog.log 2>/dev/null"));
			return { running: !!alive, pid: pid || "", recent: log || "暂无重拨记录" };
		}
	},
	// AT 查询（ADB 通道 /dev/at_mdm0；白名单只读指令）
	at_cmd: {
		args: { cmd: "" },
		call: function(request) {
			const cmd = trim(request.args.cmd || "");
			const white = [ "AT", "ATI", "AT+CGMR", "AT+CGSN", "AT+CIMI", "AT+COPS?", "AT+C5GREG?", "AT+CEREG?", "AT+CREG?", "AT+CGREG?", "AT+CFUN?", "AT+CSQ", "AT+CPIN?", "AT+temp?", "AT+CMGF?", "AT+CGDCONT?", "AT+CGACT?", "AT+CGCONTRDP=5", "AT+CGPADDR=5" ];
			let allowed = false;
			for (let c in white)
				if (c == cmd) allowed = true;
			if (!allowed)
				return { ok: false, error: "仅允许预设只读查询指令" };
			const out = exec("sh /usr/bin/m5g-at.sh '" + cmd + "' 2>&1");
			const ok = !!match(out, /OK|READY|IMEI|Manufacturer|TSENS|CMCC|SINR|C5GREG|CGCONTRDP|CGACT|ATT/);
			return { ok: ok, output: trim(out) || "无响应（模块 AT 引擎可能忙）" };
		}
	},
	// 只读：模块温度（AT+temp? 解析 TSENS）
	temp: {
		call: function() {
			const out = exec("sh /usr/bin/m5g-at.sh 'AT+temp?' 2>&1");
			const m = match(out, /TSENS:\s*(\d+)C/);
			return { ok: !!m, tsens: m ? m[1] : "", output: trim(out) };
		}
	},
	// 控制：延迟自动切回 5G（后台脚本，收信模式兜底；关页面也会执行）
	auto_back: {
		args: { seconds: "" },
		call: function(request) {
			const seconds = trim(request.args.seconds || "");
			if (!match(seconds, /^[0-9]{1,4}$/))
				return { ok: false, error: "秒数非法" };
			exec("sh /usr/bin/m5g-sms-back.sh " + seconds + " >/dev/null 2>&1 &");
			return { ok: true, detail: "已设置 " + seconds + " 秒后自动切回 5G" };
		}
	}
};

return { modem5g: methods };
