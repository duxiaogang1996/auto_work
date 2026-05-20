// ===== 功能入口 + BatchProcessor 实例 =====
import { addLog, setStatus, showResults, hideResults, getCookie, parsePhonesList, summarizePhones, getFirstPhone, removeFirstPhone, postJson, formatDate, sleep } from './utils.js';
import { renderRechargeHead, renderSuspendHead, renderCancelHead, renderResumeHead, renderCancelAccountCheckHead, renderBalanceSimpleHead, renderBalanceLedgerHead, renderCdrHead, renderCdrTotalHead, renderRows, appendResultRow, renderResultSummary, updateResultCounters, renderBalanceLedgerPivot } from './result_rendering.js';
import { BatchProcessor, isBatchRunning, getBatchStopRequested, getBatchActiveKind, startBatch, endBatch, setStopButtonEnabled, setProgress, resetProgress } from './batch_engine.js';
import { getSelectedFunction } from './ui_controller.js';

// 各功能的 BatchProcessor 实例
const rechargeProcessor = new BatchProcessor({
    kind: "recharge",
    apiUrl: "/api/recharge/process_one",
    logTitle: "分月返还补赠费",
    logDescription: "逐号查询未返还月份，计算应赠金额，执行赠费并校验",
    renderType: "recharge",
    renderHeadFn: renderRechargeHead,
    buildPayload: (cookie, phone) => {
        const dryRun = document.getElementById("rechargeDryRun") ? !!document.getElementById("rechargeDryRun").checked : false;
        const maxGift = document.getElementById("rechargeMaxGift") ? String(document.getElementById("rechargeMaxGift").value || "12") : "12";
        const billSleep = document.getElementById("rechargeBillSleep") ? parseFloat(document.getElementById("rechargeBillSleep").value || "0.3") : 0.3;
        const afterGiftSleep = document.getElementById("rechargeAfterGiftSleep") ? parseFloat(document.getElementById("rechargeAfterGiftSleep").value || "0.5") : 0.5;
        return { cookie, phone, dry_run: dryRun, max_gift_amount: maxGift, bill_sleep_s: billSleep, after_gift_sleep_s: afterGiftSleep };
    },
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
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
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
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
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
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
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
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
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
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
    getTotal: () => summarizePhones(document.getElementById("phones").value).count,
    extractPhone: getFirstPhone,
    removePhone: removeFirstPhone,
});

// 详单查询
async function runCdr() {
    if (isBatchRunning()) {
        if (getBatchActiveKind() === "cdr") { requestBatchStop(); addLog("已请求停止"); }
        else { addLog("当前正在批处理，无法查询详单"); }
        return;
    }
    const cookie = getCookie();
    const phonesText = document.getElementById("phones") ? String(document.getElementById("phones").value || "") : "";
    const phones = parsePhonesList(phonesText);
    const serviceType = document.getElementById("cdrServiceType") ? String(document.getElementById("cdrServiceType").value || "") : "";
    const resultMode = document.getElementById("cdrResultMode") ? String(document.getElementById("cdrResultMode").value || "detail") : "detail";
    const startTime = document.getElementById("cdrStartDate") ? String(document.getElementById("cdrStartDate").value || "") : "";
    const endTime = document.getElementById("cdrEndDate") ? String(document.getElementById("cdrEndDate").value || "") : "";

    if (!cookie) { setStatus("Cookie 不能为空", "error"); return; }
    if (!phones.length) { setStatus("手机号列表不能为空", "error"); return; }
    if (!startTime || !endTime) { setStatus("开始日期/结束日期不能为空", "error"); return; }

    // 二次确认
    var funcLabel = "号码详单查询";
    if (!confirm("即将执行 " + funcLabel + "\n手机号数量：" + phones.length + "\n确认执行？")) return;

    showResults();
    if (resultMode === "detail") renderCdrHead();
    else renderCdrTotalHead();
    setStatus("执行中...（正在查询详单）", "loading");

    startBatch("cdr");
    addLog("===== 开始批处理：号码详单查询 =====");
    addLog("-> 待查询号码总数：" + phones.length);
    let done = 0;
    const rowsOut = [];
    const counters = { total: 0, success: 0, fail: 0 };
    let firstRow = true;

    for (let i = 0; i < phones.length; i++) {
        if (getBatchStopRequested()) { addLog("用户请求停止批处理"); break; }
        const phone = String(phones[i] || "").trim();
        if (!phone) continue;
        done += 1;
        setProgress(done, phones.length);
        setStatus("执行中...（" + done + "/" + phones.length + "）", "loading");
        addLog("▶ 开始查询第 " + done + " 个号码：" + phone);

        const r = await postJson("/api/cdr/query", { cookie, phone, service_type: serviceType, result_mode: resultMode, start_time: startTime, end_time: endTime });

        let row;
        if (r.parse_error) {
            addLog("✗ 响应解析失败：" + r.parse_error);
            row = { phone, total_record: "", page_count: "", total_charge: "" };
            if (resultMode === "total") rowsOut.push(row);
        } else if (!r.ok || !r.data || !r.data.success) {
            const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
            addLog("✗ 接口执行失败：" + msg);
            row = { phone, total_record: "", page_count: "", total_charge: "" };
            if (resultMode === "total") rowsOut.push(row);
        } else {
            addLog("✓ 查询成功");
            if (resultMode === "total") {
                row = { phone, total_record: r.data.total_record ?? "", page_count: r.data.page_count ?? "", total_charge: r.data.total_charge ?? "" };
                rowsOut.push(row);
            } else {
                const list = Array.isArray(r.data.data) ? r.data.data : [];
                for (const item of list) { item.phone = phone; rowsOut.push(item); }
                row = list[0] || { phone };
            }
        }

        if (row) {
            var renderType = resultMode === "total" ? "cdr_total" : "cdr";
            updateResultCounters(counters, row, renderType);
            if (firstRow) {
                renderRows(rowsOut, renderType);
                firstRow = false;
            } else {
                if (resultMode === "total") appendResultRow(row, renderType);
                else renderRows(rowsOut, renderType); // detail 会多行，仍需全量
            }
            renderResultSummary(null, renderType, counters);
        }
        await sleep(0);
    }

    setProgress(done, phones.length);
    setStatus("完成", "ok");
    addLog("===== 批处理完成：详单查询 =====");
    endBatch();
}

// ===== 功能标签映射 =====
const FUNC_LABELS = {
    recharge: "补赠费",
    suspend: "停机筛号",
    cancel: "撤单",
    resume: "开机",
    cancel_account: "销户校验",
    balance: "余额/状态查询",
    cdr: "号码详单查询",
};

const FUNC_DANGEROUS = {
    recharge: true,   // 涉及资金
    suspend: true,    // 停机影响使用
    resume: false,
    cancel: true,     // 撤单不可逆
    cancel_account: false,
    balance: false,
    cdr: false,
};

// ===== 各功能的 run 入口 =====

function run() { runWithConfirm("recharge", () => { rechargeProcessor.run(getCookie()); }); }
function runSuspend() { runWithConfirm("suspend", () => { suspendProcessor.run(getCookie()); }); }
function runCancel() { runWithConfirm("cancel", () => { cancelProcessor.run(getCookie()); }); }
function runResume() { runWithConfirm("resume", () => { resumeProcessor.run(getCookie()); }); }
function runCancelAccountCheck() { runWithConfirm("cancel_account", () => { cancelAccountProcessor.run(getCookie()); }); }

function runBalanceQuery() {
    const modeEl = document.getElementById("balanceQueryMode");
    const mode = modeEl ? String(modeEl.value || "simple") : "simple";
    balanceProcessor.renderType = mode === "ledger" ? "balance_ledger" : "balance";
    balanceProcessor.renderHeadFn = mode === "ledger" ? renderBalanceLedgerHead : renderBalanceSimpleHead;
    balanceProcessor.buildPayload = (cookie, phone) => ({ cookie, phone, mode });
    balanceProcessor.run(getCookie());
}

function runWithConfirm(funcKey, action) {
    var label = FUNC_LABELS[funcKey] || funcKey;
    var ta = document.getElementById("phones");
    var phoneCount = summarizePhones(ta ? ta.value : "").count;

    if (FUNC_DANGEROUS[funcKey]) {
        if (!confirm("即将执行 " + label + "\n手机号数量：" + phoneCount + "\n\n请确认已核对操作信息，是否继续？")) return;
    }
    action();
}

function runSelected() {
    const func = getSelectedFunction();
    const runners = {
        recharge: run, suspend: runSuspend, cancel: runCancel,
        resume: runResume, cancel_account: runCancelAccountCheck,
        balance: runBalanceQuery, cdr: runCdr,
    };
    const fn = runners[func];
    if (fn) fn();
}

// 供 HTML onclick 调用
window.runSelected = runSelected;

// ===== 清空日志时也要重置占位 =====
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("runSelectedBtn");
    if (btn) btn.addEventListener("click", runSelected);
    hideResults();
    setStopButtonEnabled(false);

    const startEl = document.getElementById("cdrStartDate");
    const endEl = document.getElementById("cdrEndDate");
    if (startEl && !startEl.value) { const d = new Date(); d.setDate(d.getDate() - 7); startEl.value = formatDate(d); }
    if (endEl && !endEl.value) endEl.value = formatDate(new Date());

    const stopBtn = document.getElementById("stopRunBtn");
    if (stopBtn) stopBtn.addEventListener("click", requestBatchStop);

    const clearLogBtn = document.getElementById("clearLogBtn");
    if (clearLogBtn) {
        clearLogBtn.addEventListener("click", () => {
            const area = document.getElementById("logArea");
            if (area) area.innerHTML = "";
            // 恢复占位
            const card = document.getElementById("logCard");
            if (card && !card.classList.contains("log-card-placeholder")) {
                card.classList.add("log-card-placeholder");
            }
        });
    }

    // 初始为空时显示占位
    const card = document.getElementById("logCard");
    const area = document.getElementById("logArea");
    if (card && area && area.children.length === 0) {
        card.classList.add("log-card-placeholder");
    }

    // Cookie 恢复
    const { restoreCookie } = window.__utils || {};
    if (typeof restoreCookie === "function") restoreCookie();
});
