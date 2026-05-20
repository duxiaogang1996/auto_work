// ===== 批处理引擎 =====
import { addLog, postJson, setStatus, showResults, sleep } from './utils.js';
import { renderRows, appendResultRow, renderResultSummary, updateResultCounters, renderBalanceLedgerPivot } from './result_rendering.js';

let _batchRunning = false;
let _batchStopRequested = false;
let _batchActiveKind = "";

function _setStopButtonEnabled(enabled) {
    const btn = document.getElementById("stopRunBtn");
    if (!btn) return;
    btn.disabled = !enabled;
}

export function setProgress(current, total) {
    const bar = document.getElementById("progressFill");
    const text = document.getElementById("progressText");
    const wrap = bar && bar.closest(".progress-wrap");
    if (wrap) wrap.style.display = "flex";
    if (!bar && !text) return;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (bar) bar.style.width = Math.min(pct, 100) + "%";
    if (text) text.textContent = current + " / " + total + " (" + pct + "%)";
}

export function resetProgress() {
    const bar = document.getElementById("progressFill");
    const text = document.getElementById("progressText");
    const wrap = bar && bar.closest(".progress-wrap");
    if (wrap) wrap.style.display = "none";
    if (bar) bar.style.width = "0%";
    if (text) text.textContent = "";
}

function _startBatch(kind) {
    _batchRunning = true;
    _batchStopRequested = false;
    _batchActiveKind = kind;
    _setStopButtonEnabled(true);
    resetProgress();
}

function _endBatch() {
    _batchRunning = false;
    _batchStopRequested = false;
    _batchActiveKind = "";
    _setStopButtonEnabled(false);
}

export function isBatchRunning() {
    return _batchRunning;
}

export function getBatchStopRequested() {
    return _batchStopRequested;
}

export function getBatchActiveKind() {
    return _batchActiveKind;
}

export function startBatch(kind) {
    _startBatch(kind);
}

export function endBatch() {
    _endBatch();
}

export function setStopButtonEnabled(enabled) {
    _setStopButtonEnabled(enabled);
}

export function requestBatchStop() {
    if (_batchRunning) {
        _batchStopRequested = true;
        addLog("已请求停止（将于当前号码处理完成后停止）", "warn");
    }
}

// 供 HTML 全局事件引用
window.isBatchRunning = isBatchRunning;
window.requestBatchStop = requestBatchStop;

/**
 * BatchProcessor - 可配置的批处理器。
 * 性能优化：增量追加 + 累计计数 + 进度条。
 */
export class BatchProcessor {
    constructor(cfg) {
        this.kind = cfg.kind;
        this.apiUrl = cfg.apiUrl;
        this.logTitle = cfg.logTitle;
        this.logDescription = cfg.logDescription || "";
        this.renderType = cfg.renderType;
        this.buildPayload = cfg.buildPayload;
        this.renderHeadFn = cfg.renderHeadFn || null;
        this.onResult = cfg.onResult || null;
        this.getTotal = cfg.getTotal || null;
        this.extractPhone = cfg.extractPhone;
        this.removePhone = cfg.removePhone;
        this.dataKey = cfg.dataKey || null;
    }

    async run(cookie) {
        if (_batchRunning) {
            if (_batchActiveKind === this.kind) {
                _batchStopRequested = true;
                addLog("已请求停止（将于当前号码处理完成后停止）", "warn");
            } else {
                addLog("当前正在批处理，无法执行", "warn");
            }
            return;
        }

        _startBatch(this.kind);
        addLog("===== 开始批处理：" + this.logTitle + " =====", "info");
        if (this.logDescription) addLog("-> " + this.logDescription, "info");

        const total = this.getTotal ? this.getTotal() : 0;
        if (total) addLog("-> 待处理号码总数：" + total, "info");

        if (this.renderHeadFn) this.renderHeadFn();
        showResults();

        let done = 0;
        const results = [];
        const counters = { total: 0, success: 0, fail: 0 };
        let firstRow = true;
        const isLedger = this.renderType === "balance_ledger";

        while (true) {
            if (_batchStopRequested) {
                addLog("用户请求停止批处理");
                addLog("===== 批处理停止：" + this.logTitle + " =====");
                break;
            }

            const phone = this.extractPhone();
            if (!phone) {
                addLog("✓ 所有号码处理完成");
                break;
            }

            done += 1;
            setProgress(done, total);
            setStatus("执行中...（" + done + "/" + total + "）", "loading");
            addLog("---");
            addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone, "info");
            addLog("-> 请求接口：POST " + this.apiUrl, "info");

            const r = await postJson(this.apiUrl, this.buildPayload(cookie, phone));

            let row;
            if (r.parse_error) {
                addLog("✗ 响应解析失败：" + r.parse_error, "error");
                row = { phone: phone, message: "响应解析失败：" + r.parse_error };
            } else {
                addLog("-> HTTP 响应状态码：" + r.status, "info");
                if (!r.ok || !r.data || !r.data.success) {
                    const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                    addLog("✗ 接口执行失败：" + msg, "error");
                    row = { phone: phone, message: msg };
                } else {
                    row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                    results.push(row);
                    if (this.onResult) this.onResult(row, r.data, results);
                }
            }

            // 增量更新统计
            updateResultCounters(counters, row, this.renderType);

            // 增量渲染
            if (isLedger) {
                // 透视表需要全量重算
                renderBalanceLedgerPivot(results);
            } else if (firstRow) {
                // 第一行：清空并渲染第一条
                renderRows(results, this.renderType);
                firstRow = false;
            } else {
                // 后续行：增量追加
                appendResultRow(row, this.renderType);
            }
            // 统计用累计计数，无需遍历
            renderResultSummary(null, this.renderType, counters);

            this.removePhone(phone);
            addLog("-> 已从输入手机号列表移除：" + phone, "info");
            addLog("-> 当前进度：已处理 " + done + " / " + total, "info");
            await sleep(0);
        }

        setProgress(done, total > 0 ? total : done);
        setStatus("完成", "ok");
        addLog("===== 批处理完成：" + this.logTitle + " =====", "info");
        addLog("-> 总计处理号码：" + done, "info");
        _endBatch();
    }
}
