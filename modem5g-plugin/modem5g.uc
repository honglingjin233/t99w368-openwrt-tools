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

// 带超时的命令执行（防止单条重命令长时间阻塞 rpcd 串行队列，导致全 LuCI 排队）
const execm = (cmd, secs) => {
	const t = secs || 10;
	return exec("timeout " + t + " " + cmd);
};

// 本机 ucode 构建的全局 join() 在 rpcd 环境返回 null（实测缺陷）→ 手写拼接
function joinArr(arr, sep) {
	let out = "";
	for (let i = 0; i < length(arr); i++) {
		if (i > 0) out += sep;
		out += arr[i];
	}
	return out;
};

function firstMatch(text, re) {
	let m = match(text, re);
	return m ? m[1] : "";
}

// 动态获取当前 Modem 索引（热插拔/重枚举后编号会递增）
function getModemIndex() {
	const L = execm("mmcli -L", 8);
	return firstMatch(L, /Modem\/(\d+)/) || "";
}

// 将 MM 索引解析为 sysfs 物理路径（netifd proto modemmanager 要求路径；数值索引会漂移不可靠）
function modemSysfsPath(idx) {
	return trim(execm("sh /usr/bin/m5g-dev.sh " + idx, 8));
}

// 同步 uci device 到当前 modem 的 sysfs 路径（重拨前校准；仅变化时写防刷 flash）
function syncDevicePath(idx) {
	if (!idx)
		return;
	const path = modemSysfsPath(idx);
	if (!path)
		return;
	const cur = trim(exec("uci get network.wwan.device 2>/dev/null"));
	if (cur != path) {
		exec("uci set network.wwan.device='" + path + "'");
		exec("uci commit network");
	}
}

// hold 文件（内容=epoch 秒），与看门狗互斥：看门狗见 <120s 的新 hold 让路
const HOLD = {
	redial: "/tmp/m5g-redial.hold",
	reset: "/tmp/m5g-reset.hold",
	scan: "/tmp/m5g-scan.hold"
};
function holdSet(key) { exec("date +%s > " + HOLD[key]); }
function holdClear(key) { exec("rm -f " + HOLD[key]); }

// mmcli --output-json 结构化状态（无 ANSI 颜色码，比表格解析稳）
function mmStatus(idx) {
	if (!idx)
		return {};
	let out = execm("mmcli -m " + idx + " --output-json 2>&1", 8);
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
	const sigOut = execm("mmcli -m " + idx + " --signal-setup=30 >/dev/null 2>&1; mmcli -m " + idx + " --signal-get --output-json 2>&1", 8);
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
		ports: joinArr(g["ports"] || [], ", "),
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

// 重拨数据面（ifdown + sleep + ifup），最多等 ~30s；验证真实连通（ping 网关）防假连接
// 全程持 redial.hold 与看门狗互斥；先校准 device 为 sysfs 路径
function doRedial() {
	const idx = getModemIndex();
	syncDevicePath(idx);
	holdSet("redial");
	execm("ifdown wwan 2>/dev/null", 15);
	exec("sleep 2");
	execm("ifup wwan 2>/dev/null", 20);
	let ok = false, ip = "";
	for (let i = 0; i < 10; i++) {
		exec("sleep 3");
		ip = firstMatch(execm("ip addr show wwan0 2>/dev/null", 8), /inet\s+([0-9.]+)/);
		if (ip) {
			// 验证真实连通：ping 默认网关（曾有"有 IP 但网关不通"假连接）
			const gw = firstMatch(execm("ip route 2>/dev/null | grep wwan0 | grep default", 8), /default via (\S+)/);
			if (gw) {
				if (match(execm("ping -c 1 -W 2 " + gw + " 2>&1", 8), /1 (packets )?received/)) {
					ok = true;
					break;
				}
				// 假连接：继续等下一轮（模块可能在切换/重拨）
				continue;
			}
			ok = true;
			break;
		}
	}
	holdClear("redial");
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

// 多模组适配表（v4 新增）：MM 通用能力对任意 MBIM 模组生效；AT 增强层按模组分发
const MODULE_ADAPTERS = {
	"T99W368": { ifname: "wwan0", temp_cmd: "AT+temp?", model_re: /TSENS/ },
	"FM350-GL": { ifname: "wwan0", temp_cmd: "AT+QTEMP?", model_re: /QTEMP/ },
	"RM500Q-CN": { ifname: "wwan0", temp_cmd: "AT+QTEMP?", model_re: /QTEMP/ }
};
function adapterFor(model) {
	return MODULE_ADAPTERS[model] || MODULE_ADAPTERS["T99W368"];
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
				wwan0_ipv6: firstMatch(execm("ip -6 addr show wwan0 scope global 2>/dev/null", 8), /inet6\s+([0-9a-f:]+)/) || "",
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
			// 防单引号注入（rpcd 为 root）：单引号包裹的 uci 值里其他字符均为字面量，只禁单引号 + 限长
			if (length(pass) > 63 || match(pass, /'/))
				return { ok: false, error: "密码含非法字符（不允许单引号，且不超过 63 字符）" };
			exec("cp /etc/config/network /tmp/network.bak.m5g");
			exec("cp /etc/config/network /tmp/network.bak.m5g.$(date +%s)");
			exec("ls /tmp/network.bak.m5g.* 2>/dev/null | sort | sed -n '6,$p' | xargs rm -f 2>/dev/null");
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
			// 记录切换前制式（供收信/发短信后自动恢复原制式，不再写死 3g|4g|5g）
			// 重枚举过渡期 MM 可能报 allowed: null → 重试一次；仍无效则不覆盖已有有效记录
			let beforeJson = execm("mmcli -m " + idx + " --output-json 2>&1", 8);
			let bm = "";
			try {
				let bj = json(beforeJson);
				bm = bj && bj.modem && bj.modem.generic ? (bj.modem.generic["current-modes"] || "") : "";
			} catch (e) {}
			if (match(bm, /null/) || bm == "") {
				sleep(2);
				beforeJson = execm("mmcli -m " + idx + " --output-json 2>&1", 8);
				try {
					let bj = json(beforeJson);
					bm = bj && bj.modem && bj.modem.generic ? (bj.modem.generic["current-modes"] || "") : "";
				} catch (e) {}
			}
			const bmm = match(bm, /allowed:\s*([^;]+);\s*preferred:\s*(\S+)/);
			if (bmm) {
				const bn = [];
				for (let p in split(bmm[1], ",")) {
					const t = trim(p);
					if (t && t != "null") push(bn, t);
				}
				const allowedNorm = joinArr(bn, "|");
				if (allowedNorm && !match(allowedNorm, /null/))
					writefile("/tmp/m5g-mode-before", allowedNorm + "\n" + trim(bmm[2]) + "\n");
			}
			let cmd = "mmcli -m " + idx + " --set-allowed-modes=\"" + allowed + "\"";
			if (preferred)
				cmd += " --set-preferred-mode=\"" + preferred + "\"";
			const out = execm(cmd + " 2>&1", 20);
			const ok = !!match(out, /successfully/);
			return { ok: ok, output: trim(out),
				detail: ok ? "网络制式已切换" : "切换失败: " + trim(out) };
		}
	},
	// 控制：启用模块
	enable: {
		call: function() {
			const idx = getModemIndex();
			const out = execm("mmcli -m " + idx + " -e 2>&1", 15);
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "模块已启用" : "启用失败: " + trim(out) };
		}
	},
	// 控制：禁用模块（会断开数据面）
	disable: {
		call: function() {
			const idx = getModemIndex();
			const out = execm("mmcli -m " + idx + " -d 2>&1", 15);
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
			const out = execm("mmcli -m " + idx + " -r 2>&1", 20);
			const ok = !!match(out, /successfully/);
			if (ok) {
				holdSet("reset");
				exec("sh /usr/bin/m5g-reset-restore.sh >/dev/null 2>&1 &");
			}
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
			const out = execm("mmcli -m " + idx + " --set-current-bands=\"" + bands + "\" 2>&1", 20);
			const ok = !!match(out, /successfully/);
			return { ok: ok, detail: ok ? "频段设置已应用" : "设置失败: " + trim(out) };
		}
	},
	// 只读：SIM 卡短信列表（含内容/号码/时间）
	sms_list: {
		call: function() {
			const idx = getModemIndex();
			const L = execm("mmcli -m " + idx + " --messaging-list-sms 2>&1", 8);
			const smsPaths = [];
			for (let line in split(L, "\n")) {
				let m = match(line, /SMS\/(\d+)\s+\((\w+)\)/);
				if (m)
					push(smsPaths, { index: m[1], state: m[2] });
			}
			// 详情只拉最后 5 条（每条 mmcli -s 约 0.1-0.3s，全拉会阻塞 rpcd 串行队列）；其余仅状态
			// ★ ucode 的 for...in 遍历的是数组元素（非下标），用计数器定位尾部
			const DETAIL_LIMIT = 5;
			const list = [];
			let smsPos = 0;
			const smsTotal = length(smsPaths);
			for (let s in smsPaths) {
				smsPos++;
				const isDetail = smsPos > smsTotal - DETAIL_LIMIT;
				if (isDetail) {
					const out = execm("mmcli -s " + s.index + " --output-json 2>&1", 8);
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
					} catch (e) {
						push(list, { index: s.index, state: s.state, number: "", text: "", timestamp: "" });
					}
				} else {
					push(list, { index: s.index, state: s.state, number: "", text: "", timestamp: "" });
				}
			}
			// 倒序：最新在前；上限 20 条（防列表膨胀）
			const rev = [];
			const cap = length(list) > 20 ? length(list) - 20 : 0;
			for (let i = length(list) - 1; i >= cap; i--)
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
			const out = execm("mmcli -m " + idx + " --messaging-create-sms=\"" + number + "\" --messaging-create-sms-with-text=/tmp/m5g-sms.txt 2>&1", 20);
			let m = match(out, /SMS\/(\d+)/);
			if (!m)
				return { ok: false, error: "创建短信失败: " + trim(out) };
			const sid = m[1];
			const sent = execm("mmcli -s " + sid + " --send 2>&1", 20);
			let ok = !!match(sent, /successfully/);
			// MM 发送是异步的：轮询状态确认已发出/失败（而非固定等待后盲目切回）
			let state = "";
			for (let i = 0; i < 15; i++) {
				const so = execm("mmcli -s " + sid + " --output-json 2>&1", 6);
				try {
					const sj = json(so);
					state = (sj && sj.sms && sj.sms.properties && sj.sms.properties["state"]) || "";
				} catch (e) {}
				if (state == "sent" || state == "failed" || state == "unknown") break;
				sleep(1);
			}
			if (state == "failed") ok = false;
			let detail;
			if (state == "sent") detail = "短信已发送";
			else if (state == "failed") detail = "发送失败(模块回报 failed): " + trim(sent);
			else if (state) detail = "已提交，状态: " + state;
			else detail = ok ? "短信已发送" : "发送失败: " + trim(sent);
			return { ok: ok, detail: detail, sms_id: sid };
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
			const out = execm("mmcli -m " + idx + " --messaging-delete-sms=" + index + " 2>&1", 10);
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
			if (!idx)
				return { ok: false, error: "未找到 Modem" };
			// SIM 与 modem 编号各自独立，重枚举后会分叉；用 -K 取 SIM 真实路径（字符串解析，不依赖 json）
			const mj = execm("mmcli -m " + idx + " -K 2>&1", 8);
			const sim = firstMatch(mj, /modem\.generic\.sim\s*:\s*(\S+)/);
			if (!sim)
				return { ok: false, error: "无法获取 SIM 路径" };
			const out = execm("mmcli -i " + sim + " 2>&1", 10);
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
			const out = execm("ping -c 4 -W 2 -I wwan0 " + host + " 2>&1", 15);
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
			// 动态上下文 id（CGCONTRDP/CGPADDR 的 cid 可为 1-9，白名单不再写死 5）
			if (!allowed && match(cmd, /^(?:AT\+CGCONTRDP=[1-9]|AT\+CGPADDR=[1-9])$/))
				allowed = true;
			if (!allowed)
				return { ok: false, error: "仅允许预设只读查询指令" };
			const out = exec("sh /usr/bin/m5g-at.sh '" + cmd + "' 2>&1");
			const ok = !!match(out, /OK|READY|IMEI|Manufacturer|TSENS|CMCC|SINR|C5GREG|CGCONTRDP|CGACT|ATT/);
			return { ok: ok, output: trim(out) || "无响应（模块 AT 引擎可能忙）" };
		}
	},
	// 只读：模块温度（v4 多模组分发：T99W368 用 AT+temp?；RM500/FM350 用 AT+QTEMP?）
	temp: {
		call: function() {
			const idx = getModemIndex();
			let model = "";
			if (idx) {
				let mo = execm("mmcli -m " + idx + " --output-json 2>&1", 6);
				try {
					let mj = json(mo);
					model = (mj && mj.modem && mj.modem.generic && mj.modem.generic["model"]) || "";
				} catch (e) {}
			}
			const cmd = match(model, /RM500|FM350/) ? "AT+QTEMP?" : "AT+temp?";
			const out = exec("sh /usr/bin/m5g-at.sh '" + cmd + "' cache 2>&1");
			let m = match(out, /TSENS:\s*(\d+)\s*C?/);
			if (!m) m = match(out, /QTEMP[:\s]*([\d,]+)/);
			if (!m) m = match(out, /(\d+)\s*C/);
			return { ok: !!m, tsens: m ? m[1] : "", output: trim(out), model: model, cmd: cmd };
		}
	},
	// 只读：趋势数据（/tmp/m5g-trend.csv 尾部 N 条：ts,rsrp,snr,tsens,rx+tx）
	trend: {
		args: { n: "" },
		call: function(request) {
			const n = int(request.args.n || "120");
			const out = exec("tail -n " + n + " /tmp/m5g-trend.csv 2>/dev/null");
			const lines = split(trim(out), "\n");
			const arr = [];
			for (let l in lines) {
				const p = split(l, ",");
				if (length(p) >= 5 && p[0] != "#ts") {
					push(arr, { t: p[0], rsrp: p[1], snr: p[2], tsens: p[3], rt: p[4] });
				}
			}
			return { points: arr };
		}
	},
	// 只读：实时速率（看门狗趋势缓存最后两点算，避免在 rpcd 内 sleep 阻塞整个 ubus 队列）
	// 说明：趋势 CSV 存的是 rx+tx 合计计数（rt 字段），故返回合计速率
	speed: {
		call: function() {
			const tail = exec("tail -n 2 /tmp/m5g-trend.csv 2>/dev/null");
			const lines = split(trim(tail), "\n");
			let mbps = 0;
			if (length(lines) >= 2) {
				const a = split(lines[0], ",");
				const b = split(lines[1], ",");
				if (length(a) >= 5 && length(b) >= 5 && a[0] != "#ts" && b[0] != "#ts") {
					const dt = (int(b[0]) - int(a[0])) || 60;
					const dr = int(b[4]) - int(a[4]);
					if (dr >= 0 && dt > 0)
						mbps = dr * 8 / dt / 1000000;
				}
			}
			return { ok: true, total_mbps: sprintf("%.2f", mbps),
				dl_mbps: sprintf("%.2f", mbps), ul_mbps: sprintf("%.2f", mbps),
				dl: sprintf("%.2f", mbps), ul: sprintf("%.2f", mbps),
				note: "趋势缓存只存 rx+tx 合计，dl/ul 均等于合计值" };
			}
			},
			// 控制：一键诊断（action=start 后台生成 / action=get 读取报告）
	diagnostic: {
		args: { action: "" },
		call: function(request) {
			const action = trim(request.args.action || "start");
			if (action == "start") {
				exec("sh /usr/bin/m5g-diag.sh >/dev/null 2>&1 &");
				return { ok: true, detail: "诊断开始，约 60 秒完成" };
			}
			if (action == "get") {
				const out = exec("cat /tmp/m5g-diag.txt 2>/dev/null");
				return { ok: !!match(out, /诊断报告/), output: trim(out) || "报告生成中，请稍后…" };
			}
			return { ok: false, error: "action 参数非法" };
		}
	},
	// 控制：延迟自动恢复原制式（收信/发短信后端兜底；恢复的是切 4G 前记录的原制式）
	auto_back: {
		args: { seconds: "" },
		call: function(request) {
			const seconds = trim(request.args.seconds || "");
			if (!match(seconds, /^[0-9]{1,4}$/))
				return { ok: false, error: "秒数非法" };
			if (seconds == "0") {
				// 取消定时 + 立即恢复切换前记录的原制式（记录无效/被污染时回退默认 3g|4g|5g/5g）
				exec("touch /tmp/m5g-smsback.cancel");
				exec("rmdir /tmp/m5g-smsback.lock 2>/dev/null");
				const idx = getModemIndex();
				let a = trim(exec("sed -n '1p' /tmp/m5g-mode-before 2>/dev/null"));
				let p = trim(exec("sed -n '2p' /tmp/m5g-mode-before 2>/dev/null"));
				if (!a || match(a, /null/) || !match(a, /^[A-Za-z0-9|]+$/)) a = "3g|4g|5g";
				if (!p || !match(p, /^[A-Za-z0-9]+$/)) p = "5g";
				if (idx) {
					let cmd = "mmcli -m " + idx + " --set-allowed-modes=\"" + a + "\"";
					if (p) cmd += " --set-preferred-mode=\"" + p + "\"";
					execm(cmd + " 2>&1", 20);
				}
				exec("rm -f /tmp/m5g-mode-before");
				return { ok: true, detail: "已取消定时并恢复原制式" };
			}
			// 重新武装前清掉可能残留的取消标记（否则新定时器一醒来就被取消）
			exec("rm -f /tmp/m5g-smsback.cancel");
			exec("sh /usr/bin/m5g-sms-back.sh " + seconds + " >/dev/null 2>&1 &");
			return { ok: true, detail: "已设置 " + seconds + " 秒后自动恢复原制式" };
		}
	},
	// ============ v4 新增：看门狗开关 ============
	watchdog_set: {
		args: { action: "" },
		call: function(request) {
			const action = trim(request.args.action || "status");
			if (action == "status") {
				const pid = trim(exec("cat /tmp/m5g-watchdog.pid 2>/dev/null"));
				const alive = pid && trim(exec("kill -0 " + pid + " 2>/dev/null && echo 1"));
				return { running: !!alive, pid: pid || "" };
			}
			if (action == "start") {
				const pid = trim(exec("cat /tmp/m5g-watchdog.pid 2>/dev/null"));
				const alive = pid && trim(exec("kill -0 " + pid + " 2>/dev/null && echo 1"));
				if (alive)
					return { ok: true, detail: "看门狗已在运行" };
				exec("setsid sh /usr/bin/m5g-watchdog.sh >/dev/null 2>&1 < /dev/null &");
				exec("grep -q m5g-watchdog /etc/rc.local 2>/dev/null || sed -i '/exit 0/i setsid sh /usr/bin/m5g-watchdog.sh >/dev/null 2>&1 &' /etc/rc.local");
				return { ok: true, detail: "看门狗已启动并写入开机自启" };
			}
			if (action == "stop") {
				const pid = trim(exec("cat /tmp/m5g-watchdog.pid 2>/dev/null"));
				if (pid)
					exec("kill " + pid + " 2>/dev/null");
				exec("sed -i '/m5g-watchdog/d' /etc/rc.local");
				exec("rm -f /tmp/m5g-watchdog.pid");
				return { ok: true, detail: "看门狗已停止并移除开机自启" };
			}
			return { ok: false, error: "action 非法(start/stop/status)" };
		}
	},
	// ============ v4 新增：断网事件时间线 ============
	watchdog_log: {
		args: { n: "" },
		call: function(request) {
			const n = int(request.args.n || "30");
			const out = exec("tail -n " + n + " /tmp/m5g-watchdog.log 2>/dev/null");
			const evts = [];
			for (let line in split(trim(out), "\n")) {
				let m = match(line, /^(\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.*)$/);
				if (m) {
					let type = "info";
					const msg = m[2];
					if (match(msg, /重拨|假连接|无 IP/)) type = "redial";
					else if (match(msg, /disabled|自动启用/)) type = "enable";
					else if (match(msg, /ModemManager|无 modem/)) type = "mm";
					push(evts, { time: m[1], msg: msg, type: type });
				}
			}
			const rev = [];
			for (let i = length(evts) - 1; i >= 0; i--)
				push(rev, evts[i]);
			return { events: rev, count: length(rev) };
		}
	},
	// ============ v4 新增：信号硬核指标（MM 信号 + 今日趋势统计）============
	deep_signal: {
		call: function() {
			try {
			const idx = getModemIndex();
			const info = mmStatus(idx);
			// ucode 无 Array.filter（实测）→ 手写过滤出 5G NR 频段
			const rawBands = info["cur_bands"] || [];
			const bands = [];
			for (let b in rawBands)
				if (match(b, /^ngran-/))
					push(bands, b);
			// 当日 0 点 epoch：busybox ash 无 GNU date -d 也不支持 10# 前缀
			// → 先 ${H#0} 去前导零（08/09 被当八进制会报错），再算术
			// 注意：ucode 双引号字符串可能把 ${...} 当模板插值 → 用字符串拼接拆开
			const t0exp = "N=$(date +%s); H=$(date +%H); M=$(date +%M); S=$(date +%S); "
				+ "H=$" + "{H#0}; M=$" + "{M#0}; S=$" + "{S#0}; "
				+ "echo $(( N - H*3600 - M*60 - S ))";
			const t0 = trim(exec(t0exp)) || "0";
			const stat = exec("awk -F, -v t0=" + t0 + " 'NR>1 && $1>=t0 && $2!=\"--\" && $2!=\"\" {n++; s+=$2; if(n==1||$2>mx)mx=$2; if(n==1||$2<mn)mn=$2} END{if(n)printf \"%d %d %.1f\", mn, mx, s/n; else printf \"-- -- --\"}' /tmp/m5g-trend.csv 2>/dev/null");
			const sp = split(trim(stat), " ");
			const tstat = exec("awk -F, -v t0=" + t0 + " 'NR>1 && $1>=t0 && $4!=\"--\" && $4!=\"\" {n++; s+=$4; if(n==1||$4>mx)mx=$4; if(n==1||$4<mn)mn=$4} END{if(n)printf \"%d %d %.1f\", mn, mx, s/n; else printf \"-- -- --\"}' /tmp/m5g-trend.csv 2>/dev/null");
			const tp = split(trim(tstat), " ");
			return {
				tech: info["access_tech"] || "",
				bands: bands,
				signal_5g: { rsrp: info["signal_5g_rsrp"] || "", rsrq: info["signal_5g_rsrq"] || "", snr: info["signal_5g_snr"] || "" },
				signal_lte: { rsrp: info["signal_lte_rsrp"] || "", snr: info["signal_lte_snr"] || "" },
				today_rsrp: { min: sp[0] || "--", max: sp[1] || "--", avg: sp[2] || "--" },
				today_tsens: { min: tp[0] || "--", max: tp[1] || "--", avg: tp[2] || "--" }
			};
			} catch (e) {
				return { tech: "", bands: [], signal_5g: {}, signal_lte: {}, today_rsrp: {}, today_tsens: {}, error: "异常: " + e };
			}
		}
	},
	// ============ v4 新增：智能选网（信号阈值切换，默认关）============
	signal_guard: {
		args: { action: "", enabled: "", threshold: "" },
		call: function(request) {
			const action = trim(request.args.action || "get");
			if (action == "get") {
				const en = trim(exec("uci get modem5g.guard.enabled 2>/dev/null"));
				const th = trim(exec("uci get modem5g.guard.threshold 2>/dev/null"));
				const cd = trim(exec("uci get modem5g.guard.cooldown 2>/dev/null"));
				return { enabled: (en == "1"), threshold: th || "-110", cooldown: cd || "600" };
			}
			if (action == "set") {
				const enabled = trim(request.args.enabled || "");
				const threshold = trim(request.args.threshold || "");
				if (enabled == "1") {
					if (!match(threshold, /^-[0-9]{1,3}$/))
						return { ok: false, error: "阈值格式非法（如 -110）" };
					const t = int(threshold);
					if (t > -80 || t < -130)
						return { ok: false, error: "阈值应在 -130 ~ -80 之间" };
					exec("uci set modem5g.guard.enabled='1'");
					exec("uci set modem5g.guard.threshold='" + threshold + "'");
					exec("uci commit modem5g");
					exec("setsid sh /usr/bin/m5g-signal-guard.sh >/dev/null 2>&1 < /dev/null &");
					return { ok: true, detail: "智能选网已开启：5G RSRP < " + threshold + " dBm 连续 3 次自动切 4G，10 分钟后尝试恢复 5G" };
				}
				exec("uci set modem5g.guard.enabled='0'");
				exec("uci commit modem5g");
				const pid = trim(exec("cat /tmp/m5g-signal-guard.pid 2>/dev/null"));
				if (pid)
					exec("kill " + pid + " 2>/dev/null");
				exec("rm -f /tmp/m5g-signal-guard.pid");
				return { ok: true, detail: "智能选网已关闭（恢复手动制式配置）" };
			}
			return { ok: false, error: "action 非法(get/set)" };
		}
	},
	// ============ v4 新增：月度流量统计 ============
	traffic_stats: {
		call: function() {
			try {
			const out = exec("cat /tmp/m5g-traffic.log 2>/dev/null");
			const days = [];
			for (let line in split(trim(out), "\n")) {
				if (match(line, /^#/))
					continue;
				const p = split(line, " ");
				if (length(p) >= 5 && match(p[0], /^\d{4}-\d{2}-\d{2}$/)) {
					const brx = int(p[1]), btx = int(p[2]), crx = int(p[3]), ctx = int(p[4]);
					const rx = crx > brx ? crx - brx : 0;
					const tx = ctx > btx ? ctx - btx : 0;
					push(days, { day: p[0], rx: rx, tx: tx, total: rx + tx });
				}
			}
			const ym = trim(exec("date +%Y-%m"));
			let monthTotal = 0;
			for (let d in days) {
				const dp = split(d.day, "-");
				if (length(dp) >= 2 && (dp[0] + "-" + dp[1]) == ym)
					monthTotal += d.total;
			}
			const today = length(days) ? days[length(days) - 1].day : "";
			// 空 pid 时 kill -0 '' 会报错 → 先取再判，防空值
			const tpid = trim(exec("cat /tmp/m5g-traffic.pid 2>/dev/null"));
			const tAlive = tpid && trim(exec("kill -0 " + tpid + " 2>/dev/null && echo 1"));
			return { days: days, month_total: monthTotal, today: today, running: !!tAlive };
			} catch (e) {
				return { days: [], month_total: 0, today: "", running: false, error: "异常: " + e };
			}
		}
	},
	// ============ v4 新增：一键网络体检 ============
	health_check: {
		call: function() {
			try {
			const items = [];
			const add = function(name, ok, detail) { push(items, { name: name, ok: ok, detail: detail }); };
			const ip = firstMatch(exec("ip addr show wwan0 2>/dev/null") || "", /inet\s+([0-9.]+)/);
			add("数据面接口", !!ip, ip ? ("wwan0 = " + ip) : "wwan0 无 IPv4 地址");
			const gw = firstMatch(exec("ip route 2>/dev/null | grep wwan0 | grep default") || "", /default via (\S+)/);
			if (gw) {
				const gp = exec("ping -c 2 -W 2 " + gw + " 2>&1") || "";
				add("网关连通", !!match(gp, /1 packets received|2 packets received/), "网关 " + gw);
			} else {
				add("网关连通", false, "未找到 wwan0 默认网关");
			}
			const pp = exec("ping -c 3 -W 2 -I wwan0 223.5.5.5 2>&1") || "";
			const ps = match(pp, /(\d+) packets transmitted, (\d+) received/);
			add("公网连通(223.5.5.5)", ps ? int(ps[2]) > 0 : false, ps ? (ps[1] + " 发 / " + ps[2] + " 收") : trim(split(pp, "\n")[0]));
			const dn0 = exec("nslookup www.baidu.com 2>&1") || "";
			let dnsOk = !!match(dn0, /Address/);
			let dnsDetail = dnsOk ? "www.baidu.com 解析成功" : "";
			// nslookup 可能未装（dnsutils 非默认包）→ 降级 host / ping 域名实测
			if (!dnsOk) {
				const dn1 = exec("host www.baidu.com 2>&1") || "";
				dnsOk = !!match(dn1, /has address/);
				if (dnsOk) dnsDetail = "www.baidu.com 解析成功(host)";
			}
			if (!dnsOk) {
				const dn2 = exec("ping -c 1 -W 2 -I wwan0 www.baidu.com 2>&1") || "";
				dnsOk = !!match(dn2, /1 packets received|bytes from/);
				if (dnsOk) dnsDetail = "www.baidu.com 域名可通(ping 实测)";
			}
			if (!dnsOk) dnsDetail = "解析失败(nslookup/host/ping 均不可用)";
			add("DNS 解析", dnsOk, dnsDetail);
			const mt = exec("ping -c 1 -W 2 -s 1450 -M do -I wwan0 223.5.5.5 2>&1") || "";
			const mtOk = !!match(mt, /1 packets received|bytes from/);
			add("MTU 1450 探测", mtOk, mtOk ? "可通过（数据面可承载 1450B 报文）" : "1450 过大或不支持 -M（可接受，不影响上网）");
			let okCount = 0;
			for (let i in items)
				if (i.ok) okCount++;
			return { items: items, ok_count: okCount, total: length(items), summary: okCount + " / " + length(items) + " 项通过" };
			} catch (e) {
				return { items: [], ok_count: 0, total: 0, summary: "异常: " + e };
			}
		}
	},
	// ============ v4 新增：LED 状态联动 ============
	list_leds: {
		call: function() {
			const out = exec("ls /sys/class/leds/ 2>/dev/null");
			const leds = [];
			for (let l in split(trim(out), "\n"))
				if (trim(l)) push(leds, trim(l));
			const cur = trim(exec("uci get modem5g.led.name 2>/dev/null"));
			const en = trim(exec("uci get modem5g.led.enabled 2>/dev/null"));
			return { leds: leds, current: cur || "", enabled: (en == "1") };
		}
	},
	led_map: {
		args: { led: "", enabled: "" },
		call: function(request) {
			const led = trim(request.args.led || "");
			const enabled = trim(request.args.enabled || "");
			if (!match(led, /^[a-zA-Z0-9:_-]{1,64}$/))
				return { ok: false, error: "LED 名称非法" };
			exec("uci set modem5g.led.name='" + led + "'");
			exec("uci set modem5g.led.enabled='" + (enabled == "1" ? "1" : "0") + "'");
			exec("uci commit modem5g");
			if (enabled == "1") {
				exec("setsid sh /usr/bin/m5g-led.sh >/dev/null 2>&1 < /dev/null &");
				return { ok: true, detail: "LED 联动已开启（" + led + " 亮=已连接）" };
			}
			const pid = trim(exec("cat /tmp/m5g-led.pid 2>/dev/null"));
			if (pid)
				exec("kill " + pid + " 2>/dev/null");
			exec("rm -f /tmp/m5g-led.pid");
			exec("echo 0 > /sys/class/leds/" + led + "/brightness 2>/dev/null");
			return { ok: true, detail: "LED 联动已关闭" };
		}
	},
	// ============ v4 新增：多模组适配信息 ============
	module_profile: {
		call: function() {
			const idx = getModemIndex();
			const info = mmStatus(idx);
			const model = info["model"] || "";
			const ad = adapterFor(model);
			return {
				model: model,
				adapter: MODULE_ADAPTERS[model] ? ("内置适配器（" + model + "）") : "回退默认（T99W368 适配）",
				temp_cmd: ad.temp_cmd,
				ifname: ad.ifname,
				note: "状态/拨号/短信走 ModemManager 通用层（任意 MBIM 模组）；温度/AT 增强层按模组分发"
			};
		}
	}
};

return { modem5g: methods };
