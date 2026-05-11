// ===== 批处理引擎 =====

let _batchRunning = false;
let _batchStopRequested = false;
let _batchActiveKind = "";
let _batchResults = [];

function _setStopButtonEnabled(enabled) {
    const btn = document.getElementById("stopRunBtn");
    if (!btn) return;
    btn.disabled = !enabled;
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

/**
 * BatchProcessor - 可配置的批处理器。
 * 每个功能只需实例化一次，传入配置对象即可。
 */
class BatchProcessor {
    constructor(cfg) {
        this.kind = cfg.kind;
        this.apiUrl = cfg.apiUrl;
        this.logTitle = cfg.logTitle;
        this.logDescription = cfg.logDescription || "";
        this.renderType = cfg.renderType;
        this.buildPayload = cfg.buildPayload;       // (cookie, phone) => body
        this.renderHeadFn = cfg.renderHeadFn || null;
        this.onResult = cfg.onResult || null;        // 可选：每行结果额外处理
        this.getTotal = cfg.getTotal || null;         // () => number
        this.extractPhone = cfg.extractPhone;        // () => string
        this.removePhone = cfg.removePhone;          // (phone) => void
        this.dataKey = cfg.dataKey || null;          // 可选：结果存储 key（如 currentSuspendData）
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
            setStatus("执行中...（" + done + "/" + total + "）", "loading");
            addLog("---");
            addLog("▶ 开始处理第 " + done + " / " + total + " 个号码：" + phone, "info");
            addLog("-> 请求接口：POST " + this.apiUrl, "info");

            const r = await _postJson(this.apiUrl, this.buildPayload(cookie, phone));

            if (r.parse_error) {
                addLog("✗ 响应解析失败：" + r.parse_error, "error");
                results.push({ phone: phone, message: "响应解析失败：" + r.parse_error });
            } else {
                addLog("-> HTTP 响应状态码：" + r.status, "info");
                if (!r.ok || !r.data || !r.data.success) {
                    const msg = (r.data && r.data.message) ? r.data.message : "接口返回失败";
                    addLog("✗ 接口执行失败：" + msg, "error");
                    results.push({ phone: phone, message: msg });
                } else {
                    const row = (r.data.data && r.data.data[0]) ? r.data.data[0] : { phone: phone, message: "无返回数据" };
                    results.push(row);
                    if (this.onResult) this.onResult(row, r.data, results);
                }
            }

            // 渲染结果表格 + 摘要
            if (this.renderType === "balance_ledger") {
                renderBalanceLedgerPivot(results);
            } else {
                renderRows(results, this.renderType);
            }
            renderResultSummary(results, this.renderType);

            this.removePhone(phone);
            addLog("-> 已从输入手机号列表移除：" + phone, "info");
            addLog("-> 当前进度：已处理 " + done + " / " + total, "info");
            await _sleep(0);
        }

        setStatus("完成", "ok");
        addLog("===== 批处理完成：" + this.logTitle + " =====", "info");
        addLog("-> 总计处理号码：" + done, "info");
        _endBatch();
    }
}
