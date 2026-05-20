// ===== 工具函数 =====

const LOG_MAX_LINES = 500;

export function setStatus(text, kind) {
    const el = document.getElementById("status");
    el.textContent = text || "";
    el.className = "status " + (kind || "");
}

export function normalizeCookie(raw) {
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

export function getCookie() {
    const ta = document.getElementById("cookie");
    if (!ta) return "";
    const cleaned = normalizeCookie(ta.value);
    if (cleaned && cleaned !== ta.value) ta.value = cleaned;
    // 持久化到 sessionStorage（浏览器关闭即清除）
    if (cleaned) {
        try { sessionStorage.setItem("auto_console_cookie", cleaned); } catch (e) { /* ignore */ }
    }
    return cleaned;
}

/** 页面加载时自动恢复上次的 Cookie */
export function restoreCookie() {
    const ta = document.getElementById("cookie");
    if (!ta) return;
    try {
        const saved = sessionStorage.getItem("auto_console_cookie");
        if (saved && !ta.value) ta.value = saved;
    } catch (e) { /* ignore */ }
}

export function clearSavedCookie() {
    const ta = document.getElementById("cookie");
    if (ta) ta.value = "";
    try { sessionStorage.removeItem("auto_console_cookie"); } catch (e) { /* ignore */ }
}

export function parsePhonesList(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
    const parts = raw.split("\n").map(s => s.trim()).filter(Boolean);
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

export function redactForLog(value) {
    if (value && typeof value === "object") {
        if (Array.isArray(value)) return value.map(redactForLog);
        const out = {};
        for (const k of Object.keys(value)) {
            if (k.toLowerCase() === "cookie") {
                const v = String(value[k] || "");
                out[k] = "<redacted len=" + v.length + ">";
                continue;
            }
            out[k] = redactForLog(value[k]);
        }
        return out;
    }
    return value;
}

export function stringifyForLog(value, maxLen = 3000) {
    let s = "";
    try { s = JSON.stringify(redactForLog(value)); } catch (e) { s = String(value); }
    if (s.length > maxLen) return s.slice(0, maxLen) + "...(truncated)";
    return s;
}

export function summarizePhones(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
    const parts = raw.split("\n").map(s => s.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    return { count: unique.length, sample: unique.slice(0, 5) };
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function postJson(path, body) {
    const fullPath = window.location.origin + path;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 分钟超时
    try {
        const resp = await fetch(fullPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        let data = null;
        try { data = await resp.json(); } catch (e) { return { ok: false, status: resp.status, data: null, parse_error: e }; }
        return { ok: resp.ok, status: resp.status, data: data, parse_error: null };
    } catch (e) {
        if (e.name === "AbortError") return { ok: false, status: 0, data: null, parse_error: new Error("请求超时") };
        return { ok: false, status: 0, data: null, parse_error: e };
    } finally {
        clearTimeout(timeout);
    }
}

export function addLog(text, level) {
    const card = document.getElementById("logCard");
    const area = document.getElementById("logArea");
    if (!card || !area) return;
    card.style.display = "block";
    card.classList.remove("log-card-placeholder");

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const prefix = "[" + hh + ":" + mm + ":" + ss + "] ";

    const div = document.createElement("div");
    div.textContent = prefix + text;
    if (level === "success" || level === "ok") div.className = "log-success";
    else if (level === "error" || level === "err") div.className = "log-error";
    else if (level === "warn" || level === "warning") div.className = "log-warn";
    else div.className = "log-info";

    area.appendChild(div);

    // 限制最大行数
    while (area.children.length > LOG_MAX_LINES) {
        area.removeChild(area.firstChild);
    }

    var autoScroll = document.getElementById("autoScrollCheck");
    if (!autoScroll || autoScroll.checked) {
        area.scrollTop = area.scrollHeight;
    }
}

export function boolText(v) {
    if (v === true) return "是";
    if (v === false) return "否";
    return "-";
}

export function showResults() {
    const table = document.getElementById("resultTable");
    const empty = document.getElementById("resultEmpty");
    const headerArea = document.getElementById("resultHeaderArea");
    if (empty) empty.style.display = "none";
    if (table) table.style.display = "table";
    if (headerArea) headerArea.style.display = "flex";
}

export function hideResults() {
    const head = document.getElementById("resultHead");
    const body = document.getElementById("resultBody");
    const table = document.getElementById("resultTable");
    const empty = document.getElementById("resultEmpty");
    const headerArea = document.getElementById("resultHeaderArea");
    if (head) head.innerHTML = "";
    if (body) body.innerHTML = "";
    if (table) table.style.display = "none";
    if (empty) empty.style.display = "block";
    if (headerArea) headerArea.style.display = "none";
}

export function normalizePhonesText(text) {
    return String(text || "").replace(/\r\n/g, "\n").replace(/,/g, "\n");
}

export function getFirstPhone() {
    const ta = document.getElementById("phones");
    if (!ta) return "";
    const normalized = normalizePhonesText(ta.value);
    if (normalized !== ta.value) ta.value = normalized;
    const lines = normalized.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i] || "").trim();
        if (!line) continue;
        const m = line.match(/1\d{10}/);
        if (m && m[0]) return m[0];
        const first = summarizePhones(line).sample[0];
        if (first) return first;
    }
    return "";
}

export function removeFirstPhone(phone) {
    const ta = document.getElementById("phones");
    if (!ta) return;
    const normalized = normalizePhonesText(ta.value);
    const lines = normalized.split("\n");
    let removed = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = String(lines[i] || "");
        const line = raw.trim();
        if (!removed && line) {
            if (raw.indexOf(phone) !== -1) { removed = true; continue; }
            const m = line.match(/1\d{10}/);
            if (m && m[0] === phone) { removed = true; continue; }
        }
        out.push(raw);
    }
    ta.value = out.join("\n").replace(/^\n+/, "");
    try { ta.selectionStart = 0; ta.selectionEnd = 0; } catch (e) { }
}

export function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
}

export function toggleCookieExpand() {
    var ta = document.getElementById("cookie");
    var btn = document.querySelector(".cookie-expand-btn");
    if (!ta || !btn) return;
    var isCollapsed = ta.classList.contains("collapsed");
    if (isCollapsed) {
        ta.classList.remove("collapsed");
        btn.innerHTML = "&#9650;";
    } else {
        ta.classList.add("collapsed");
        btn.innerHTML = "&#9660;";
    }
}

let _phoneCounterTimer = null;

export function updatePhoneCounter() {
    // debounce: 停止输入 300ms 后执行
    if (_phoneCounterTimer) clearTimeout(_phoneCounterTimer);
    _phoneCounterTimer = setTimeout(function() {
        _phoneCounterTimer = null;
        var counter = document.getElementById("phoneCounter");
        if (!counter) return;
        var ta = document.getElementById("phones");
        var text = ta ? ta.value : "";
        var raw = text.replace(/\r\n/g, "\n").replace(/,/g, "\n");
        var parts = raw.split("\n").map(function(s) { return s.trim(); }).filter(Boolean);
        var unique = [];
        var seen = {};
        var invalid = [];
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (seen[p]) continue;
            seen[p] = true;
            if (!/^1\d{10}$/.test(p)) invalid.push(p);
            unique.push(p);
        }
        var html = "已识别 <span class='count-num'>" + unique.length + "</span> 个号码";
        if (invalid.length > 0) {
            html += "，<span class='invalid-num'>" + invalid.length + " 个格式异常</span>";
        }
        counter.innerHTML = html;
    }, 300);
}

// 供 HTML onclick/oninput 调用
window.toggleCookieExpand = toggleCookieExpand;
window.updatePhoneCounter = updatePhoneCounter;
window.clearSavedCookie = clearSavedCookie;
