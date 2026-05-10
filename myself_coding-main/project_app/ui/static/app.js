function setStatus(text, kind) {
    const el = document.getElementById("status");
    el.textContent = text || "";
    el.className = "status " + (kind || "");
}

function _normalizeCookie(raw) {
    let s = String(raw || "");
    s = s.replace(/`/g, "").trim();
    if (!s) return "";

    function stripQuotes(x) {
        const t = String(x || "").trim();
        if (t.length >= 2) {
            const a = t[0];
            const b = t[t.length - 1];
            if ((a === "'" && b === "'") || (a === '"' && b === '"')) return t.slice(1, -1).trim();
        }
        return t;
    }

    s = stripQuotes(s);

    if (s.indexOf("curl") !== -1) {
        const m1 = s.match(/-H\s+'Cookie:\s*([^']+)'/i) || s.match(/-H\s+\"Cookie:\s*([^\"]+)\"/i);
        const m2 = s.match(/--header\s+'Cookie:\s*([^']+)'/i) || s.match(/--header\s+\"Cookie:\s*([^\"]+)\"/i);
        const m = m1 || m2;
        if (m && m[1]) return stripQuotes(m[1]);
    }

    const lines = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length > 1) {
        for (let i = 0; i < lines.length; i++) {
            const ln = String(lines[i] || "").trim();
            if (!ln) continue;
            if (ln.toLowerCase().indexOf("cookie:") === 0) {
                return stripQuotes(ln.split(":", 2)[1] || "");
            }
        }
        const merged = lines.map(x => String(x || "").trim()).filter(Boolean).join(" ");
        if (merged.toLowerCase().indexOf("cookie:") === 0) return stripQuotes(merged.split(":", 2)[1] || "");
        return stripQuotes(merged);
    }

    if (s.toLowerCase().indexOf("cookie:") === 0) return stripQuotes(s.split(":", 2)[1] || "");
    return stripQuotes(s);
}

function _getCookieFromTextarea() {
    const ta = document.getElementById("cookie");
    if (!ta) return "";
    const cleaned = _normalizeCookie(ta.value);
    if (cleaned && cleaned !== ta.value) ta.value = cleaned;
    return cleaned;
}

function _redactForLog(value) {
    if (value && typeof value === "object") {
        if (Array.isArray(value)) return value.map(_redactForLog);
        const out = {};
        for (const k of Object.keys(value)) {
            if (k.toLowerCase() === "cookie") {
                const v = String(value[k] || "");
                out[k] = "<redacted len=" + v.length + ">";
                continue;
            }
            out[k] = _redactForLog(value[k]);
        }
        return out;
    }
    return value;
}

function _stringifyForLog(value, maxLen = 3000) {
    let s = "";
    try {
        s = JSON.stringify(_redactForLog(value));
    } catch (e) {
        s = String(value);
    }
    if (s.length > maxLen) return s.slice(0, maxLen) + "...(truncated)";
    return s;
}

function _summarizePhones(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
    const parts = raw
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);
    const unique = Array.from(new Set(parts));
    return {
        count: unique.length,
        sample: unique.slice(0, 5),
    };
}

function _summarizeResultResponse(data) {
    if (!data || typeof data !== "object") return data;
    const out = {
        success: data.success,
        message: data.message,
    };
    if (Array.isArray(data.data)) {
        out.data_len = data.data.length;
        out.first = data.data[0];
    } else {
        out.data = data.data;
    }
    return out;
}

function addLog(text) {
    const card = document.getElementById("logCard");
    const area = document.getElementById("logArea");
    if (!card || !area) return;
    card.style.display = "block";
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    area.textContent += "[" + hh + ":" + mm + ":" + ss + "] " + text + "\n";
    area.scrollTop = area.scrollHeight;
}

{
    const clearBtn = document.getElementById("clearLogBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const area = document.getElementById("logArea");
            if (area) area.textContent = "";
        });
    }
}

{
    const stopBtn = document.getElementById("stopRunBtn");
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (!_batchRunning) return;
            _batchStopRequested = true;
            addLog("已请求停止（将于当前号码处理完成后停止）");
        });
    }
}

function showResults() {
    const table = document.getElementById("resultTable");
    const empty = document.getElementById("resultEmpty");
    const headerArea = document.getElementById("resultHeaderArea");
    if (empty) empty.style.display = "none";
    if (table) table.style.display = "table";
    if (headerArea) headerArea.style.display = "flex";
}

function hideResults() {
    const table = document.getElementById("resultTable");
    const head = document.getElementById("resultHead");
    const body = document.getElementById("resultBody");
    const empty = document.getElementById("resultEmpty");
    const headerArea = document.getElementById("resultHeaderArea");

    if (head) head.innerHTML = "";
    if (body) body.innerHTML = "";
    if (table) table.style.display = "none";
    if (empty) empty.style.display = "block";
    if (headerArea) headerArea.style.display = "none";
}

function boolText(v) {
    if (v === true) return "是";
    if (v === false) return "否";
    return "-";
}

let currentSuspendData = null;
let currentResumeData = null;
let _batchRunning = false;
let _batchStopRequested = false;
let _batchActiveKind = "";
let _batchResults = [];

function _setStopButtonEnabled(enabled) {
    const btn = document.getElementById("stopRunBtn");
    if (!btn) return;
    btn.disabled = !enabled;
}

function renderRechargeHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>未返还月份</th>
            <th>扣款总和</th>
            <th>已赠费</th>
            <th>应赠费</th>
            <th>赠费前余额</th>
            <th>赠费后余额</th>
            <th>差值</th>
            <th>赠费成功</th>
            <th>校验通过</th>
            <th>结果</th>
        </tr>
    `;
}

function renderSuspendHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>状态</th>
        </tr>
    `;
}

function renderCancelHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>查询状态</th>
            <th>查询说明</th>
            <th>可撤单</th>
            <th>用户状态</th>
            <th>订单状态</th>
            <th>订单号</th>
            <th>撤单状态</th>
            <th>撤单说明</th>
        </tr>
    `;
}

function renderResumeHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>原余额</th>
            <th>套餐名称</th>
            <th>原状态</th>
            <th>可开机</th>
            <th>已请求</th>
            <th>开机成功</th>
            <th>结果说明</th>
        </tr>
    `;
}

function renderCancelAccountCheckHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>号码</th>
            <th>余额</th>
            <th>是否可销户</th>
        </tr>
    `;
}

function renderCdrHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>开始时间</th>
            <th>类型</th>
            <th>对端号码</th>
            <th>费用</th>
        </tr>
    `;
}

function renderCdrTotalHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>总量</th>
            <th>页数</th>
            <th>总费用</th>
        </tr>
    `;
}

function _getSelectedBalanceFields() {
    const fields = [
        { id: 'phone', label: '手机号', required: true },
        { id: 'plan_name', label: '套餐名称', required: false },
        { id: 'user_status', label: '状态', required: false },
        { id: 'balance', label: '余额', required: false },
        { id: 'active_time', label: '激活时间', required: false },
        { id: 'owe_amount', label: '欠费金额', required: false },
        { id: 'message', label: '结果', required: true },
    ];
    return fields.filter(f => {
        if (f.required) return true;
        const cb = document.getElementById('balanceField_' + f.id);
        return cb && cb.checked;
    });
}

function renderBalanceSimpleHead() {
    const fields = _getSelectedBalanceFields();
    const thHtml = fields.map(f => `<th>${f.label}</th>`).join('');
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr>${thHtml}</tr>`;
}

function renderBalanceLedgerHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `
        <tr>
            <th>手机号</th>
            <th>套餐</th>
            <th>状态</th>
            <th>激活时间</th>
            <th>余额</th>
            <th>欠费金额</th>
            <th>结果</th>
        </tr>
    `;
}

function renderBalanceLedgerPivot(rows) {
    const head = document.getElementById("resultHead");
    const body = document.getElementById("resultBody");
    if (!head || !body) return;
    body.innerHTML = "";

    const ledgerKeys = [];
    const ledgerSeen = {};
    const byPhone = {};

    for (const r of rows) {
        const phone = String((r && r.phone) || "");
        if (!phone) continue;
        if (!byPhone[phone]) {
            byPhone[phone] = {
                phone: phone,
                plan_name: r.plan_name != null ? r.plan_name : "-",
                user_status: r.user_status != null ? r.user_status : "-",
                active_time: r.active_time != null ? r.active_time : "-",
                balance: r.balance != null ? r.balance : "-",
                owe_amount: r.owe_amount != null ? r.owe_amount : "-",
                message: r.message != null ? r.message : "-",
                ledgers: {},
            };
        }
        const itemName = String((r.item_name || "")).trim();
        if (!itemName) continue;
        let key = itemName;
        if (r.item_type === "资源账本" && r.unit) key = itemName + "(" + r.unit + ")";
        if (!ledgerSeen[key]) {
            ledgerSeen[key] = true;
            ledgerKeys.push(key);
        }
        let val = r.amount != null ? String(r.amount) : "";
        if (r.item_type === "资源账本") {
            const dates = [r.eff_date, r.exp_date].filter(Boolean).join("~");
            if (dates) val = val + " [" + dates + "]";
        }
        byPhone[phone].ledgers[key] = val;
    }

    let th = `
        <tr>
            <th>手机号</th>
            <th>套餐</th>
            <th>状态</th>
            <th>激活时间</th>
            <th>余额</th>
            <th>欠费金额</th>
    `;
    for (const k of ledgerKeys) {
        th += `<th>${k}</th>`;
    }
    th += `<th>结果</th></tr>`;
    head.innerHTML = th;

    const list = Object.values(byPhone);
    for (const row of list) {
        const tr = document.createElement("tr");
        const cells = [
            row.phone,
            row.plan_name,
            row.user_status,
            row.active_time,
            row.balance,
            row.owe_amount,
        ];
        for (const k of ledgerKeys) {
            cells.push(row.ledgers[k] != null ? row.ledgers[k] : "");
        }
        cells.push(row.message);
        for (const c of cells) {
            const td = document.createElement("td");
            td.textContent = String(c);
            tr.appendChild(td);
        }
        body.appendChild(tr);
    }
}

function renderRows(rows, type = "recharge") {
    const body = document.getElementById("resultBody");
    body.innerHTML = "";

    const exportBtn = document.getElementById("exportCancelAccountXlsBtn");
    if (exportBtn) {
        exportBtn.style.display = type === "cancel_account" ? "inline" : "none";
    }

    for (const r of rows) {
        const tr = document.createElement("tr");
        let cells = [];

        if (type === "recharge") {
            const months = Array.isArray(r.unreturned_months) ? r.unreturned_months.join(",") : "";
            cells = [
                r.phone != null ? r.phone : "",
                months,
                r.total_deduct != null ? r.total_deduct : "",
                r.gifted_amount != null ? r.gifted_amount : "",
                r.final_gift_amount != null ? r.final_gift_amount : "",
                r.balance_before != null ? r.balance_before : "-",
                r.balance_after != null ? r.balance_after : "-",
                r.balance_diff != null ? r.balance_diff : "-",
                boolText(r.gift_success),
                boolText(r.validate_ok),
                r.message != null ? r.message : "",
            ];
        } else if (type === "suspend") {
            cells = [
                r.phone != null ? r.phone : "",
                r.status != null ? r.status : "",
            ];
        } else if (type === "cancel") {
            cells = [
                r.phone != null ? r.phone : "",
                r.query_type != null ? r.query_type : "",
                r.query_content != null ? r.query_content : "",
                boolText(r.can_cancel),
                r.user_status != null ? r.user_status : "-",
                r.order_status != null ? r.order_status : "-",
                r.jd_order_id != null ? r.jd_order_id : "-",
                r.cancel_type != null ? r.cancel_type : "-",
                r.cancel_content != null ? r.cancel_content : "-",
            ];
        } else if (type === "cdr") {
            cells = [
                r.phone != null ? r.phone : "",
                r.start_time != null ? r.start_time : "",
                r.call_type != null ? r.call_type : "",
                r.called_number != null ? r.called_number : "",
                r.charge != null ? r.charge : "",
            ];
        } else if (type === "cdr_total") {
            cells = [
                r.phone != null ? r.phone : "",
                r.total_record != null ? r.total_record : "",
                r.page_count != null ? r.page_count : "",
                r.total_charge != null ? r.total_charge : "",
            ];
        } else if (type === "resume") {
            cells = [
                r.phone != null ? r.phone : "",
                r.balance != null ? r.balance : "-",
                r.plan_name != null ? r.plan_name : "-",
                r.user_status != null ? r.user_status : "-",
                boolText(r.can_resume),
                boolText(r.resume_requested),
                boolText(r.resume_success),
                r.message != null ? r.message : "-",
            ];
        } else if (type === "cancel_account") {
            cells = [
                r.phone != null ? r.phone : "",
                r.balance != null ? r.balance : "-",
                boolText(r.can_cancel),
            ];
        } else if (type === "balance") {
            const fields = _getSelectedBalanceFields();
            cells = [];
            for (const f of fields) {
                const val = r[f.id];
                if (f.id === 'phone') {
                    cells.push(val != null ? val : "");
                } else if (f.id === 'owe_amount') {
                    cells.push(val != null ? val : "-");
                } else {
                    cells.push(val != null ? val : "-");
                }
            }
        } else if (type === "balance_ledger") {
            cells = [
                r.phone != null ? r.phone : "",
                r.user_status != null ? r.user_status : "-",
                r.balance != null ? r.balance : "-",
                r.item_type != null ? r.item_type : "-",
                r.item_name != null ? r.item_name : "",
                r.amount != null ? r.amount : "",
                r.unit != null ? r.unit : "",
                r.eff_date != null ? r.eff_date : "",
                r.exp_date != null ? r.exp_date : "",
                r.message != null ? r.message : "-",
            ];
        }

        for (const c of cells) {
            const td = document.createElement("td");
            td.textContent = String(c);
            tr.appendChild(td);
        }
        body.appendChild(tr);
    }
}

function _formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
}

function _parsePhonesList(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
    const parts = raw
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);
    const out = [];
    const seen = {};
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (seen[p]) continue;
        seen[p] = true;
        out.push(p);
    }
    return out;
}

async function runCdr() {
    if (_batchRunning) {
        if (_batchActiveKind === "cdr") {
            _batchStopRequested = true;
            addLog("已请求停止（将于当前号码处理完成后停止）");
        } else {
            addLog("当前正在批处理，无法查询详单");
        }
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phonesTextEl = document.getElementById("phones");
    const phonesText = phonesTextEl ? String(phonesTextEl.value || "") : "";
    const phones = _parsePhonesList(phonesText);
    const serviceTypeEl = document.getElementById("cdrServiceType");
    const modeEl = document.getElementById("cdrResultMode");
    const startEl = document.getElementById("cdrStartDate");
    const endEl = document.getElementById("cdrEndDate");
    const service_type = serviceTypeEl ? String(serviceTypeEl.value || "") : "";
    const result_mode = modeEl ? String(modeEl.value || "detail") : "detail";
    const start_time = startEl ? String(startEl.value || "") : "";
    const end_time = endEl ? String(endEl.value || "") : "";

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phones.length) {
        setStatus("手机号列表不能为空", "error");
        return;
    }
    if (!start_time || !end_time) {
        setStatus("开始日期/结束日期不能为空", "error");
        return;
    }

    showResults();
    if (result_mode === "detail") renderCdrHead();
    else renderCdrTotalHead();
    setStatus("执行中...（正在查询详单）", "loading");
    const btn = document.getElementById("runCdrBtn");
    if (btn) btn.disabled = true;

    try {
        await _runAllCdr(cookie, phones, service_type, result_mode, start_time, end_time);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("详单请求失败：" + e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function _runAllCdr(cookie, phones, service_type, result_mode, start_time, end_time) {
    _startBatch("cdr");
    addLog("===== 开始批处理：号码详单查询 =====");
    addLog("→ 说明：逐号查询通话/短信/上网详单，支持明细或汇总");
    addLog("→ 待查询号码总数：" + phones.length);
    addLog("→ 查询参数：service_type=" + (service_type || "空（综合）") + ", result_mode=" + result_mode + ", start=" + start_time + ", end=" + end_time);
    let done = 0;
    const rowsOut = [];

    for (let i = 0; i < phones.length; i++) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：详单查询 =====");
            break;
        }
        const phone = String(phones[i] || "").trim();
        if (!phone) continue;
        done += 1;
        setStatus("执行中...（" + done + "/" + phones.length + "）", "loading");
        addLog("---");
        addLog("▶ 开始查询第 " + done + " / " + phones.length + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/cdr/query");
        addLog("→ 请求参数：phone=" + phone + ", service_type=" + (service_type || "(综合)"));
        const r = await _postJson("/api/cdr/query", { cookie: cookie, phone: phone, service_type: service_type, result_mode: result_mode, start_time: start_time, end_time: end_time });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            if (result_mode === "total") {
                rowsOut.push({ phone: phone, total_record: "", page_count: "", total_charge: "" });
                renderRows(rowsOut, "cdr_total");
            }
            addLog("→ 结果：查询失败");
            continue;
        }
        addLog("→ HTTP 响应状态码：" + r.status);
        if (!r.ok || !r.data || !r.data.success) {
            const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
            addLog("✗ 接口执行失败：" + msg);
            if (result_mode === "total") {
                rowsOut.push({ phone: phone, total_record: "", page_count: "", total_charge: "" });
                renderRows(rowsOut, "cdr_total");
            }
            addLog("→ 结果：查询失败");
            continue;
        } else {
            addLog("✓ 查询成功");
            if (result_mode === "total" && r.data && r.data.total_charge !== undefined) {
                addLog("→ 总通话资费：" + r.data.total_charge);
            } else {
                const list = Array.isArray(r.data.data) ? r.data.data : [];
                if (list.length) {
                    addLog("→ 获取到 " + list.length + " 条明细记录");
                }
            }
        }
        addLog("→ 当前进度：已查询 " + done + " / " + phones.length);

        if (result_mode === "total") {
            rowsOut.push({
                phone: phone,
                total_record: r.data.total_record != null ? String(r.data.total_record) : "",
                page_count: r.data.page_count != null ? String(r.data.page_count) : "",
                total_charge: r.data.total_charge != null ? String(r.data.total_charge) : "",
            });
            renderRows(rowsOut, "cdr_total");
        } else {
            const list = Array.isArray(r.data.data) ? r.data.data : [];
            for (let k = 0; k < list.length; k++) {
                const row = list[k] || {};
                row.phone = phone;
                rowsOut.push(row);
            }
            renderRows(rowsOut, "cdr");
        }
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：详单查询 =====");
    addLog("→ 总计查询号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

function _normalizePhonesText(text) {
    return String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
}

function _getFirstPhoneFromTextarea() {
    const ta = document.getElementById("phones");
    if (!ta) return "";
    const normalized = _normalizePhonesText(ta.value);
    if (normalized !== ta.value) ta.value = normalized;

    const lines = normalized.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i] || "").trim();
        if (!line) continue;
        const m = line.match(/1\d{10}/);
        if (m && m[0]) return m[0];
        const first = _summarizePhones(line).sample[0];
        if (first) return first;
    }
    return "";
}

function _removeFirstPhoneFromTextarea(phone) {
    const ta = document.getElementById("phones");
    if (!ta) return;
    const normalized = _normalizePhonesText(ta.value);
    const lines = normalized.split("\n");
    let removed = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = String(lines[i] || "");
        const line = raw.trim();
        if (!removed && line) {
            if (raw.indexOf(phone) !== -1) {
                removed = true;
                continue;
            }
            const m = line.match(/1\d{10}/);
            if (m && m[0] === phone) {
                removed = true;
                continue;
            }
        }
        out.push(raw);
    }
    ta.value = out.join("\n").replace(/^\n+/, "");
    try {
        ta.selectionStart = 0;
        ta.selectionEnd = 0;
    } catch (e) { }
}

async function run() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    showResults();
    renderRechargeHead();
    setStatus("执行中...（号码较多时会等待较久）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllRecharge(cookie);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("补赠费请求失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

async function runSuspend() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();
    const autoSuspendEl = document.getElementById("autoSuspendCheck");
    const auto_suspend = autoSuspendEl ? !!autoSuspendEl.checked : true;

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    showResults();
    renderSuspendHead();
    setStatus("执行中...（正在查询号码状态）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllSuspend(cookie, auto_suspend);

    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("停机筛号请求失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

async function runCancel() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    showResults();
    renderCancelHead();
    setStatus("执行中...（正在查询并撤单）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllCancel(cookie);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("撤单请求失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

async function runResume() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();
    const autoResumeEl = document.getElementById("autoResumeCheck");
    const auto_resume = autoResumeEl ? !!autoResumeEl.checked : true;
    const remarkEl = document.getElementById("resumeRemark");
    const remark = remarkEl ? String(remarkEl.value || "").trim() : "企业方开机-余额充足开机";

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    showResults();
    renderResumeHead();
    setStatus("执行中...（正在查询并开机）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllResume(cookie, auto_resume, remark);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("开机请求失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

async function runCancelAccountCheck() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    showResults();
    renderCancelAccountCheckHead();
    setStatus("执行中...（正在查询余额并筛选可销户号码）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllCancelAccountCheck(cookie);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("销户校验请求失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

async function runBalanceQuery() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）");
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phone = _getFirstPhoneFromTextarea();

    if (!cookie) {
        setStatus("Cookie 不能为空", "error");
        return;
    }
    if (!phone) {
        setStatus("手机号列表不能为空（请确保第一行是手机号）", "error");
        return;
    }

    const modeEl = document.getElementById("balanceQueryMode");
    const mode = modeEl ? String(modeEl.value || "simple") : "simple";
    const bill_yyyymm = "";

    showResults();
    if (mode === "ledger") renderBalanceLedgerHead();
    else renderBalanceSimpleHead();
    setStatus("执行中...（正在查询余额与状态）", "loading");
    document.getElementById("runSelectedBtn").disabled = true;

    try {
        await _runAllBalanceQuery(cookie, mode, bill_yyyymm);
    } catch (e) {
        setStatus("请求失败：" + e, "error");
        addLog("余额/状态查询失败：" + e);
    } finally {
        document.getElementById("runSelectedBtn").disabled = false;
    }
}

function _updateBalanceQueryUi() {
    // 账期输入框已完全移除，两种模式都不需要
    // 只需要确保DOM不存在时代码不报错即可
    const modeEl = document.getElementById("balanceQueryMode");
    if (!modeEl) return;
}

async function _runAllBalanceQuery(cookie, mode, bill_yyyymm) {
    _startBatch("balance");
    addLog("===== 开始批处理：余额/状态查询 =====");
    addLog("→ 查询模式：" + (mode === "ledger" ? "查状态+账本明细" : "只查状态+余额"));
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    let rowsOut = [];
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：余额/状态查询 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/balance/query_one");
        addLog("→ 请求参数：phone=" + phone);
        const r = await _postJson("/api/balance/query_one", { cookie: cookie, phone: phone, mode: mode });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            rowsOut.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            addLog("→ 结果：查询失败");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                rowsOut.push({ phone: phone, message: msg });
                addLog("→ 结果：查询失败");
            } else {
                const list = Array.isArray(r.data.data) ? r.data.data : [];
                if (!list.length) {
                    rowsOut.push({ phone: phone, message: "无返回数据" });
                    addLog("✓ 查询完成：无返回数据");
                } else {
                    if (mode === "ledger") {
                        for (let k = 0; k < list.length; k++) {
                            rowsOut.push(list[k] || {});
                        }
                    } else {
                        rowsOut.push(list[0] || {});
                    }
                    addLog("✓ 查询完成：返回 " + list.length + " 行");
                }
            }
        }
        if (mode === "ledger") renderBalanceLedgerPivot(rowsOut);
        else renderRows(rowsOut, "balance");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " / " + total);
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：余额/状态查询 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function _postJson(path, body) {
    const fullPath = window.location.origin + path;
    const resp = await fetch(fullPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    let data = null;
    try {
        data = await resp.json();
    } catch (e) {
        return { ok: false, status: resp.status, data: null, parse_error: e };
    }
    return { ok: resp.ok, status: resp.status, data: data, parse_error: null };
}

function _startBatch(kind) {
    _batchRunning = true;
    _batchStopRequested = false;
    _batchActiveKind = kind;
    _batchResults = [];
    _setStopButtonEnabled(true);
}

function _endBatch() {
    _batchRunning = false;
    _batchStopRequested = false;
    _batchActiveKind = "";
    _setStopButtonEnabled(false);
}

async function _runAllRecharge(cookie) {
    _startBatch("recharge");
    addLog("===== 开始批处理：分月返还补赠费 =====");
    addLog("→ 说明：逐号查询未返还月份，计算应赠金额，执行赠费并校验");
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    _batchResults = [];
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：补赠费 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/recharge/process_one");
        addLog("→ 请求参数：phone=" + phone);
        const r = await _postJson("/api/recharge/process_one", { cookie: cookie, phone: phone });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            _batchResults.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            addLog("→ 结果：处理失败");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                _batchResults.push({ phone: phone, message: (r.data && r.data.message) ? r.data.message : "执行失败" });
                addLog("→ 结果：处理失败");
            } else {
                const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                _batchResults.push(row);
                if (row.message) {
                    addLog("→ 处理结果：" + row.message);
                }
                if (row.actual_give && parseFloat(row.actual_give) > 0) {
                    addLog("✓ 执行赠费：应赠 " + row.should_give + "，实赠 " + row.actual_give);
                } else {
                    addLog("→ 无需赠费：" + (row.message || "不符合赠费条件"));
                }
            }
        }
        renderRows(_batchResults, "recharge");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " / " + total);
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：补赠费 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

async function _runAllSuspend(cookie, auto_suspend) {
    _startBatch("suspend");
    addLog("===== 开始批处理：停机筛号 =====");
    addLog("→ 说明：逐号查询余额和套餐，余额<套餐金额且在用则停机");
    addLog("→ 自动停机：" + (auto_suspend ? "开启" : "关闭"));
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    currentSuspendData = [];
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：停机筛号 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/suspend/process_one");
        addLog("→ 请求参数：phone=" + phone + ", auto_suspend=" + auto_suspend);
        const r = await _postJson("/api/suspend/process_one", { cookie: cookie, phone: phone, auto_suspend: auto_suspend });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            currentSuspendData.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            addLog("→ 结果：处理失败");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                currentSuspendData.push({ phone: phone, message: (r.data && r.data.message) ? r.data.message : "执行失败" });
                addLog("→ 结果：处理失败");
            } else {
                const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                currentSuspendData.push(row);
                if (row.message) {
                    addLog("→ 处理结果：" + row.message);
                }
                if (row.extracted_amount !== null && row.balance !== null) {
                    addLog("→ 套餐名称：" + (row.plan_name || "-"));
                    addLog("→ 提取套餐金额：" + row.extracted_amount);
                    addLog("→ 当前余额：" + row.balance);
                    if (row.can_suspend) {
                        addLog("✓ 符合条件：余额 < 套餐金额 且 在用，可以停机");
                        if (row.suspend_requested && row.suspend_success) {
                            addLog("✓ 停机成功：" + (row.suspend_message || "success"));
                        } else if (row.suspend_requested && row.suspend_success === false) {
                            addLog("✗ 停机失败：" + (row.suspend_message || "failure"));
                        } else if (!auto_suspend) {
                            addLog("→ 自动停机已关闭，仅查询不执行");
                        }
                    } else {
                        addLog("✗ 不符合停机条件，跳过");
                    }
                }
            }
        }
        renderRows(currentSuspendData, "suspend");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " / " + total);
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：停机筛号 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

async function _runAllCancel(cookie) {
    _startBatch("cancel");
    addLog("===== 开始批处理：撤单 =====");
    addLog("→ 说明：逐号查询是否可撤单，符合条件执行撤单");
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：撤单 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/cancel/process_one");
        addLog("→ 请求参数：phone=" + phone);
        const r = await _postJson("/api/cancel/process_one", { cookie: cookie, phone: phone });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            _batchResults.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            addLog("→ 结果：处理失败");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                _batchResults.push({ phone: phone, message: (r.data && r.data.message) ? r.data.message : "执行失败" });
                addLog("→ 结果：处理失败");
            } else {
                const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                _batchResults.push(row);
                if (row.message) {
                    addLog("→ 处理结果：" + row.message);
                }
                if (row.can_cancel !== undefined) {
                    if (row.can_cancel) {
                        addLog("✓ 符合可撤单条件，可以撤单");
                        if (row.cancel_success) {
                            addLog("✓ 撤单成功：" + (row.cancel_message || "success"));
                        } else if (row.cancel_success === false) {
                            addLog("✗ 撤单失败：" + (row.cancel_message || "failure"));
                        }
                    } else {
                        addLog("✗ 不符合撤单条件，无法撤单");
                    }
                }
            }
        }
        renderRows(_batchResults, "cancel");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " / " + total);
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：撤单 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

async function _runAllResume(cookie, auto_resume, remark) {
    _startBatch("resume");
    addLog("===== 开始批处理：开机 =====");
    addLog("→ 说明：逐号查询，局方停机且余额≥0自动开机");
    addLog("→ 自动开机：" + (auto_resume ? "开启" : "关闭"));
    if (remark) {
        addLog("→ 开机备注：" + remark);
    }
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    currentResumeData = [];
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：开机 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/resume/process_one");
        addLog("→ 请求参数：phone=" + phone + ", auto_resume=" + auto_resume);
        const r = await _postJson("/api/resume/process_one", { cookie: cookie, phone: phone, auto_resume: auto_resume, remark: remark });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            currentResumeData.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            addLog("→ 结果：处理失败");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                currentResumeData.push({ phone: phone, message: (r.data && r.data.message) ? r.data.message : "执行失败" });
                addLog("→ 结果：处理失败");
            } else {
                const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                currentResumeData.push(row);
                if (!row.can_resume) {
                    if (row.user_status !== "局方停机") {
                        addLog("→ 判断结果：状态不是局方停机（" + (row.user_status || "null") + "），不可开机");
                    } else if (row.balance == null || parseFloat(row.balance) < 0) {
                        addLog("→ 判断结果：余额不足（" + (row.balance || "null") + "），不可开机");
                    } else {
                        addLog("→ 判断结果：不符合开机条件，不可开机");
                    }
                } else {
                    addLog("✓ 判断结果：符合开机条件（余额≥0 且 局方停机）");
                    if (row.resume_requested && row.resume_success) {
                        addLog("✓ 开机成功：" + (row.resume_message || "success"));
                    } else if (row.resume_requested && row.resume_success === false) {
                        addLog("✗ 开机失败：" + (row.resume_message || "failure"));
                    } else if (!auto_resume) {
                        addLog("→ 自动开机已关闭，仅查询不执行");
                    }
                }
            }
        }
        renderRows(currentResumeData, "resume");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " / " + total);
        await _sleep(0);
    }
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：开机 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 结果表格已更新");
    _endBatch();
}

async function _runAllCancelAccountCheck(cookie) {
    _startBatch("cancel_account");
    addLog("===== 开始批处理：销户校验 =====");
    addLog("→ 说明：逐号查询余额，只筛选出余额≥0的号码");
    const total = _summarizePhones(document.getElementById("phones").value).count;
    addLog("→ 待处理号码总数：" + total);
    let done = 0;
    let currentCancelAccountData = [];
    while (true) {
        if (_batchStopRequested) {
            addLog("⚠ 用户请求停止批处理");
            addLog("===== 批处理停止：销户校验 =====");
            break;
        }
        const phone = _getFirstPhoneFromTextarea();
        if (!phone) {
            addLog("✓ 所有号码处理完成");
            break;
        }
        done += 1;
        setStatus("执行中...（" + done + "/" + total + "）", "loading");
        addLog("---");
        addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone);
        addLog("→ 请求接口：POST /api/cancel_account/check_one");
        addLog("→ 请求参数：phone=" + phone);
        const r = await _postJson("/api/cancel_account/check_one", { cookie: cookie, phone: phone });
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            currentCancelAccountData.push({ phone: phone, balance: null, can_cancel: false });
            addLog("→ 结果：查询失败，标记为不可销户");
        } else {
            addLog("→ HTTP 响应状态码：" + r.status);
            if (!r.ok || !r.data || !r.data.success) {
                const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                addLog("✗ 接口执行失败：" + msg);
                currentCancelAccountData.push({ phone: phone, balance: null, can_cancel: false });
                addLog("→ 结果：接口失败，标记为不可销户");
            } else {
                const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, balance: null, can_cancel: false };
                currentCancelAccountData.push(row);
                if (row.balance === null || row.balance === undefined) {
                    addLog("→ 查询结果：获取余额失败，标记为不可销户");
                } else {
                    addLog("→ 查询结果：号码余额 = " + row.balance);
                    if (row.can_cancel) {
                        addLog("✓ 符合条件：余额≥0，标记为可销户");
                    } else {
                        addLog("✗ 不符合条件：余额<0，标记为不可销户");
                    }
                }
            }
        }
        const filteredData = currentCancelAccountData.filter(r => r.can_cancel);
        renderRows(filteredData, "cancel_account");
        _removeFirstPhoneFromTextarea(phone);
        addLog("→ 已从输入手机号列表移除：" + phone);
        addLog("→ 当前进度：已处理 " + done + " 个，累计筛选出 " + filteredData.length + " 个可销户号码");
        await _sleep(0);
    }
    const finalFiltered = currentCancelAccountData.filter(r => r.can_cancel);
    setStatus("完成", "ok");
    addLog("---");
    addLog("===== 批处理完成：销户校验 =====");
    addLog("→ 总计处理号码：" + done);
    addLog("→ 筛选出可销户号码：" + finalFiltered.length);
    addLog("→ 结果表格已更新，只显示可销户号码");
    addLog("→ 点击右上角「下载可销户号码（.xls）」按钮导出");
    _endBatch();
}

function exportSuspend() {
    // 弃用，替换为纯前端统一导出
}

// 通用的下载成 Excel 逻辑
{
    const downloadBtn = document.getElementById("downloadExcelBtn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const table = document.getElementById("resultTable");
            if (!table || table.style.display === "none" || table.rows.length === 0) {
                alert("当前没有可导出的数据！");
                addLog("导出Excel失败：当前没有可导出的数据");
                return;
            }

            if (typeof XLSX === "undefined") {
                alert("导出失败：未加载Excel组件（XLSX）");
                addLog("导出Excel失败：XLSX 未定义");
                return;
            }
            const wb = XLSX.utils.table_to_book(table, { sheet: "执行结果" });

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");
            const hh = String(now.getHours()).padStart(2, "0");
            const min = String(now.getMinutes()).padStart(2, "0");
            const ss = String(now.getSeconds()).padStart(2, "0");
            const fileName = "执行结果_" + yyyy + mm + dd + "_" + hh + min + ss + ".xlsx";

            XLSX.writeFile(wb, fileName);
            addLog("导出Excel成功：" + fileName);
        });
    }
}

// 页面加载时默认隐藏结果区域
document.addEventListener('DOMContentLoaded', () => {
    hideResults();
    addLog("页面已加载，前端脚本正常运行");
    _setStopButtonEnabled(false);

    const startEl = document.getElementById("cdrStartDate");
    const endEl = document.getElementById("cdrEndDate");
    if (startEl && !startEl.value) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startEl.value = _formatDate(d);
    }
    if (endEl && !endEl.value) {
        endEl.value = _formatDate(new Date());
    }

    _updateBalanceQueryUi();
    const modeEl = document.getElementById("balanceQueryMode");
    if (modeEl) {
        modeEl.addEventListener("change", () => {
            _updateBalanceQueryUi();
        });
    }
});

// 文件上传相关逻辑
{
    const uploadBtn = document.getElementById("uploadFileBtn");
    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            const input = document.getElementById("fileInput");
            if (input) input.click();
        });
    }
}

{
    const input = document.getElementById("fileInput");
    if (input) input.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        addLog("选择文件：" + file.name);
        document.getElementById("fileNameDisplay").textContent = file.name;
        const reader = new FileReader();

        reader.onload = function (evt) {
            const data = evt.target.result;
            let phones = [];

            // 判断是否是CSV，或者是Excel
            if (file.name.toLowerCase().endsWith('.csv')) {
                // 解析CSV（简单按行分割）
                const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const lines = text.split(/\r?\n/);
                // 忽略第一行(表头)，从第二行开始取第一列
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const cols = line.split(',');
                    const phone = cols[0].replace(/['"]/g, '').trim();
                    if (phone) phones.push(phone);
                }
            } else {
                // 使用 SheetJS 解析 Excel
                if (typeof XLSX === "undefined") {
                    setStatus("解析失败：未加载Excel组件（XLSX）", "error");
                    addLog("解析Excel失败：XLSX 未定义");
                    return;
                }
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // 转换为二维数组
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                // 忽略首行（header: 1 模式下第一行是表头，jsonData从第二行开始）
                // 我们假设第一列是手机号，由于 header:1 模式，每行是个数组
                // 若 header 不为1，默认是对象数组，则取对象的第一个属性

                const rawData = XLSX.utils.sheet_to_json(worksheet);
                rawData.forEach(row => {
                    // 取对象的第一个键的值作为手机号
                    const keys = Object.keys(row);
                    if (keys.length > 0) {
                        const phone = String(row[keys[0]]).trim();
                        if (phone) phones.push(phone);
                    }
                });
            }

            // 去重并更新到文本框
            phones = [...new Set(phones)].filter(p => p.length >= 11);
            const phonesTextarea = document.getElementById("phones");
            // 保留已有的手机号并追加
            const existing = phonesTextarea.value.trim();
            if (existing) {
                phonesTextarea.value = existing + '\n' + phones.join('\n');
            } else {
                phonesTextarea.value = phones.join('\n');
            }

            setStatus(`成功从文件中读取 ${phones.length} 个手机号`, "ok");
            addLog("文件解析完成，手机号数量：" + phones.length);
        };

        if (file.name.toLowerCase().endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }

        // 清空 input 的 value，以便下次选同一个文件也能触发 change
        e.target.value = '';
    });
}

function exportCancelAccountXLS() {
    const table = document.getElementById("resultTable");
    if (!table) return;
    const rows = table.querySelectorAll("tbody tr");
    if (!rows || rows.length === 0) {
        alert("没有数据可导出");
        return;
    }
    const data = [];
    rows.forEach(r => {
        const cells = r.querySelectorAll("td");
        if (cells.length >= 3) {
            const phone = cells[0].textContent.trim();
            const canCancel = cells[2].textContent.trim() === "是";
            if (canCancel && phone) {
                data.push({ phone: phone, can_cancel: true });
            }
        }
    });
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/cancel_account/export_xls";
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data_json";
    input.value = JSON.stringify({ data: data });
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

function runSelected() {
    const sel = document.getElementById("selectedFunction");
    const func = sel.value;
    if (func === "recharge") {
        run();
    } else if (func === "suspend") {
        runSuspend();
    } else if (func === "cancel") {
        runCancel();
    } else if (func === "resume") {
        runResume();
    } else if (func === "cancel_account") {
        runCancelAccountCheck();
    } else if (func === "balance") {
        runBalanceQuery();
    } else if (func === "cdr") {
        runCdr();
    }
}

{
    const btn = document.getElementById("runSelectedBtn");
    if (btn) btn.addEventListener("click", runSelected);
}

