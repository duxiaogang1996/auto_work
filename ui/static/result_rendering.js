// ===== 结果表格渲染 =====

function renderRechargeHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr>
        <th>手机号</th><th>未返还月份</th><th>扣款总和</th><th>已赠费</th><th>应赠费</th>
        <th>赠费前余额</th><th>赠费后余额</th><th>差值</th><th>赠费成功</th><th>校验通过</th><th>结果</th>
    </tr>`;
}

function renderSuspendHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr><th>手机号</th><th>状态</th></tr>`;
}

function renderCancelHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr>
        <th>手机号</th><th>查询状态</th><th>查询说明</th><th>可撤单</th><th>用户状态</th>
        <th>订单状态</th><th>订单号</th><th>撤单状态</th><th>撤单说明</th>
    </tr>`;
}

function renderResumeHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr>
        <th>手机号</th><th>原余额</th><th>套餐名称</th><th>原状态</th><th>可开机</th>
        <th>已请求</th><th>开机成功</th><th>结果说明</th>
    </tr>`;
}

function renderCancelAccountCheckHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr><th>号码</th><th>余额</th><th>是否可销户</th></tr>`;
}

function renderCdrHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr><th>手机号</th><th>开始时间</th><th>类型</th><th>对端号码</th><th>费用</th></tr>`;
}

function renderCdrTotalHead() {
    const head = document.getElementById("resultHead");
    head.innerHTML = `<tr><th>手机号</th><th>总量</th><th>页数</th><th>总费用</th></tr>`;
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
    head.innerHTML = `<tr>
        <th>手机号</th><th>套餐</th><th>状态</th><th>激活时间</th><th>余额</th>
        <th>欠费金额</th><th>结果</th>
    </tr>`;
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
                phone, plan_name: r.plan_name != null ? r.plan_name : "-",
                user_status: r.user_status != null ? r.user_status : "-",
                active_time: r.active_time != null ? r.active_time : "-",
                balance: r.balance != null ? r.balance : "-",
                owe_amount: r.owe_amount != null ? r.owe_amount : "-",
                message: r.message != null ? r.message : "-", ledgers: {},
            };
        }
        const itemName = String((r.item_name || "")).trim();
        if (!itemName) continue;
        let key = itemName;
        if (r.item_type === "资源账本" && r.unit) key = itemName + "(" + r.unit + ")";
        if (!ledgerSeen[key]) { ledgerSeen[key] = true; ledgerKeys.push(key); }
        let val = r.amount != null ? String(r.amount) : "";
        if (r.item_type === "资源账本") {
            const dates = [r.eff_date, r.exp_date].filter(Boolean).join("~");
            if (dates) val = val + " [" + dates + "]";
        }
        byPhone[phone].ledgers[key] = val;
    }

    let th = `<tr><th>手机号</th><th>套餐</th><th>状态</th><th>激活时间</th><th>余额</th><th>欠费金额</th>`;
    for (const k of ledgerKeys) th += `<th>${k}</th>`;
    th += `<th>结果</th></tr>`;
    head.innerHTML = th;

    for (const row of Object.values(byPhone)) {
        const tr = document.createElement("tr");
        const cells = [row.phone, row.plan_name, row.user_status, row.active_time, row.balance, row.owe_amount];
        for (const k of ledgerKeys) cells.push(row.ledgers[k] != null ? row.ledgers[k] : "");
        cells.push(row.message);
        for (const c of cells) { const td = document.createElement("td"); td.textContent = String(c); tr.appendChild(td); }
        body.appendChild(tr);
    }
}

function renderRows(rows, type = "recharge") {
    const body = document.getElementById("resultBody");
    body.innerHTML = "";

    const exportBtn = document.getElementById("exportCancelAccountXlsBtn");
    if (exportBtn) exportBtn.style.display = type === "cancel_account" ? "inline" : "none";

    for (const r of rows) {
        const tr = document.createElement("tr");
        let cells = [];

        if (type === "recharge") {
            const months = Array.isArray(r.unreturned_months) ? r.unreturned_months.join(",") : "";
            cells = [r.phone ?? "", months, r.total_deduct ?? "", r.gifted_amount ?? "", r.final_gift_amount ?? "",
                r.balance_before ?? "-", r.balance_after ?? "-", r.balance_diff ?? "-",
                boolText(r.gift_success), boolText(r.validate_ok), r.message ?? ""];
        } else if (type === "suspend") {
            cells = [r.phone ?? "", r.status ?? ""];
        } else if (type === "cancel") {
            cells = [r.phone ?? "", r.query_type ?? "", r.query_content ?? "", boolText(r.can_cancel),
                r.user_status ?? "-", r.order_status ?? "-", r.jd_order_id ?? "-",
                r.cancel_type ?? "-", r.cancel_content ?? ""];
        } else if (type === "cdr") {
            cells = [r.phone ?? "", r.start_time ?? "", r.call_type ?? "", r.called_number ?? "", r.charge ?? ""];
        } else if (type === "cdr_total") {
            cells = [r.phone ?? "", r.total_record ?? "", r.page_count ?? "", r.total_charge ?? ""];
        } else if (type === "resume") {
            cells = [r.phone ?? "", r.balance ?? "-", r.plan_name ?? "-", r.user_status ?? "-",
                boolText(r.can_resume), boolText(r.resume_requested), boolText(r.resume_success), r.message ?? "-"];
        } else if (type === "cancel_account") {
            cells = [r.phone ?? "", r.balance ?? "-", boolText(r.can_cancel)];
        } else if (type === "balance") {
            const fields = _getSelectedBalanceFields();
            for (const f of fields) {
                const val = r[f.id];
                cells.push(val ?? (f.id === 'phone' ? "" : "-"));
            }
        } else if (type === "balance_ledger") {
            cells = [r.phone ?? "", r.user_status ?? "-", r.balance ?? "-", r.item_type ?? "-",
                r.item_name ?? "", r.amount ?? "", r.unit ?? "", r.eff_date ?? "", r.exp_date ?? "", r.message ?? "-"];
        }

        for (const c of cells) { const td = document.createElement("td"); td.textContent = String(c); tr.appendChild(td); }
        body.appendChild(tr);
    }
}
