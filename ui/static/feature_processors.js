// ===== 功能入口 + BatchProcessor 实例 =====

let currentSuspendData = null;
let currentResumeData = null;

// 各功能的 BatchProcessor 实例
const rechargeProcessor = new BatchProcessor({
    kind: "recharge",
    apiUrl: "/api/recharge/process_one",
    logTitle: "分月返还补赠费",
    logDescription: "逐号查询未返还月份，计算应赠金额，执行赠费并校验",
    renderType: "recharge",
    renderHeadFn: renderRechargeHead,
    buildPayload: (cookie, phone) => ({ cookie, phone }),
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
});

const suspendProcessor = new BatchProcessor({
    kind: "suspend",
    apiUrl: "/api/suspend/process_one",
    logTitle: "停机筛号",
    logDescription: "逐号查询余额和套餐，余额<套餐金额且在用则停机",
    renderType: "suspend",
    renderHeadFn: renderSuspendHead,
    buildPayload: (cookie, phone) => {
        const el = document.getElementById("autoSuspendCheck");
        return { cookie, phone, auto_suspend: el ? !!el.checked : true };
    },
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
    onResult(row, data, results) {
        if (row.message) addLog("-> 处理结果：" + row.message);
        if (row.extracted_amount !== null && row.balance !== null) {
            addLog("-> 套餐名称：" + (row.plan_name || "-"));
            addLog("-> 提取套餐金额：" + row.extracted_amount);
            addLog("-> 当前余额：" + row.balance);
            if (row.can_suspend) {
                addLog("✓ 符合条件：余额 < 套餐金额 且 在用，可以停机");
                if (row.suspend_requested && row.suspend_success) addLog("✓ 停机成功：" + (row.suspend_message || "success"));
                else if (row.suspend_requested && row.suspend_success === false) addLog("✗ 停机失败：" + (row.suspend_message || "failure"));
            } else {
                addLog("✗ 不符合停机条件，跳过");
            }
        }
        currentSuspendData = results;
    },
});

const cancelProcessor = new BatchProcessor({
    kind: "cancel",
    apiUrl: "/api/cancel/process_one",
    logTitle: "撤单",
    logDescription: "逐号查询是否可撤单，符合条件执行撤单",
    renderType: "cancel",
    renderHeadFn: renderCancelHead,
    buildPayload: (cookie, phone) => ({ cookie, phone }),
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
});

const resumeProcessor = new BatchProcessor({
    kind: "resume",
    apiUrl: "/api/resume/process_one",
    logTitle: "开机",
    logDescription: "逐号查询，局方停机且余额≥0自动开机",
    renderType: "resume",
    renderHeadFn: renderResumeHead,
    buildPayload: (cookie, phone) => {
        const autoEl = document.getElementById("autoResumeCheck");
        const remarkEl = document.getElementById("resumeRemark");
        return {
            cookie, phone,
            auto_resume: autoEl ? !!autoEl.checked : true,
            remark: remarkEl ? String(remarkEl.value || "").trim() : "企业方开机-余额充足开机",
        };
    },
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
    onResult(row, data, results) {
        if (!row.can_resume) {
            if (row.user_status !== "局方停机") addLog("-> 状态不是局方停机（" + (row.user_status || "null") + "），不可开机");
            else if (row.balance == null || parseFloat(row.balance) < 0) addLog("-> 余额不足（" + (row.balance || "null") + "），不可开机");
            else addLog("-> 不符合开机条件");
        } else {
            addLog("✓ 符合开机条件");
            if (row.resume_requested && row.resume_success) addLog("✓ 开机成功：" + (row.resume_message || "success"));
            else if (row.resume_requested && row.resume_success === false) addLog("✗ 开机失败：" + (row.resume_message || "failure"));
        }
        currentResumeData = results;
    },
});

const cancelAccountProcessor = new BatchProcessor({
    kind: "cancel_account",
    apiUrl: "/api/cancel_account/check_one",
    logTitle: "销户校验",
    logDescription: "逐号查询余额，只筛选出余额≥0的号码",
    renderType: "cancel_account",
    renderHeadFn: renderCancelAccountCheckHead,
    buildPayload: (cookie, phone) => ({ cookie, phone }),
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
});

const balanceProcessor = new BatchProcessor({
    kind: "balance",
    apiUrl: "/api/balance/query_one",
    logTitle: "余额/状态查询",
    renderType: "balance",
    renderHeadFn: renderBalanceSimpleHead,
    buildPayload: (cookie, phone) => {
        const modeEl = document.getElementById("balanceQueryMode");
        return { cookie, phone, mode: modeEl ? String(modeEl.value || "simple") : "simple" };
    },
    getTotal: () => _summarizePhones(document.getElementById("phones").value).count,
    extractPhone: _getFirstPhoneFromTextarea,
    removePhone: _removeFirstPhoneFromTextarea,
});

// 详单查询（有独立的 UI，不通用 BatchProcessor 模式）
async function runCdr() {
    if (_batchRunning) {
        if (_batchActiveKind === "cdr") { _batchStopRequested = true; addLog("已请求停止"); }
        else { addLog("当前正在批处理，无法查询详单"); }
        return;
    }
    const cookie = _getCookieFromTextarea();
    const phonesText = document.getElementById("phones") ? String(document.getElementById("phones").value || "") : "";
    const phones = _parsePhonesList(phonesText);
    const serviceType = document.getElementById("cdrServiceType") ? String(document.getElementById("cdrServiceType").value || "") : "";
    const resultMode = document.getElementById("cdrResultMode") ? String(document.getElementById("cdrResultMode").value || "detail") : "detail";
    const startTime = document.getElementById("cdrStartDate") ? String(document.getElementById("cdrStartDate").value || "") : "";
    const endTime = document.getElementById("cdrEndDate") ? String(document.getElementById("cdrEndDate").value || "") : "";

    if (!cookie) { setStatus("Cookie 不能为空", "error"); return; }
    if (!phones.length) { setStatus("手机号列表不能为空", "error"); return; }
    if (!startTime || !endTime) { setStatus("开始日期/结束日期不能为空", "error"); return; }

    showResults();
    if (resultMode === "detail") renderCdrHead();
    else renderCdrTotalHead();
    setStatus("执行中...（正在查询详单）", "loading");

    _startBatch("cdr");
    addLog("===== 开始批处理：号码详单查询 =====");
    addLog("-> 待查询号码总数：" + phones.length);
    let done = 0;
    const rowsOut = [];

    for (let i = 0; i < phones.length; i++) {
        if (_batchStopRequested) { addLog("用户请求停止批处理"); break; }
        const phone = String(phones[i] || "").trim();
        if (!phone) continue;
        done += 1;
        setStatus("执行中...（" + done + "/" + phones.length + "）", "loading");
        addLog("▶ 开始查询第 " + done + " 个号码：" + phone);

        const r = await _postJson("/api/cdr/query", { cookie, phone, service_type: serviceType, result_mode: resultMode, start_time: startTime, end_time: endTime });

        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            if (resultMode === "total") rowsOut.push({ phone, total_record: "", page_count: "", total_charge: "" });
        } else if (!r.ok || !r.data || !r.data.success) {
            const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
            addLog("✗ 接口执行失败：" + msg);
            if (resultMode === "total") rowsOut.push({ phone, total_record: "", page_count: "", total_charge: "" });
        } else {
            addLog("✓ 查询成功");
            if (resultMode === "total") {
                rowsOut.push({ phone, total_record: r.data.total_record ?? "", page_count: r.data.page_count ?? "", total_charge: r.data.total_charge ?? "" });
            } else {
                const list = Array.isArray(r.data.data) ? r.data.data : [];
                for (const item of list) { item.phone = phone; rowsOut.push(item); }
            }
        }

        if (resultMode === "total") renderRows(rowsOut, "cdr_total");
        else renderRows(rowsOut, "cdr");
        await _sleep(0);
    }

    setStatus("完成", "ok");
    addLog("===== 批处理完成：详单查询 =====");
    _endBatch();
}

// ===== 各功能的 run 入口 =====

function run() { rechargeProcessor.run(_getCookieFromTextarea()); }

function runSuspend() { suspendProcessor.run(_getCookieFromTextarea()); }

function runCancel() { cancelProcessor.run(_getCookieFromTextarea()); }

function runResume() { resumeProcessor.run(_getCookieFromTextarea()); }

function runCancelAccountCheck() { cancelAccountProcessor.run(_getCookieFromTextarea()); }

function runBalanceQuery() {
    const modeEl = document.getElementById("balanceQueryMode");
    const mode = modeEl ? String(modeEl.value || "simple") : "simple";
    balanceProcessor.renderType = mode === "ledger" ? "balance_ledger" : "balance";
    balanceProcessor.renderHeadFn = mode === "ledger" ? renderBalanceLedgerHead : renderBalanceSimpleHead;
    balanceProcessor.buildPayload = (cookie, phone) => ({ cookie, phone, mode });
    balanceProcessor.run(_getCookieFromTextarea());
}

function runSelected() {
    const sel = document.getElementById("selectedFunction");
    const func = sel.value;
    const runners = {
        recharge: run, suspend: runSuspend, cancel: runCancel,
        resume: runResume, cancel_account: runCancelAccountCheck,
        balance: runBalanceQuery, cdr: runCdr,
    };
    const fn = runners[func];
    if (fn) fn();
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("runSelectedBtn");
    if (btn) btn.addEventListener("click", runSelected);
    hideResults();
    _setStopButtonEnabled(false);

    const startEl = document.getElementById("cdrStartDate");
    const endEl = document.getElementById("cdrEndDate");
    if (startEl && !startEl.value) { const d = new Date(); d.setDate(d.getDate() - 7); startEl.value = _formatDate(d); }
    if (endEl && !endEl.value) endEl.value = _formatDate(new Date());
});
