// ===== 浏览器登录获取 Cookie =====
import { addLog, setStatus } from './utils.js';

export function openBrowserLogin() {
    var btn = document.getElementById("openBrowserLoginBtn");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "⏳ 等待登录中...";
    addLog("正在打开浏览器，请在登录页面输入账号密码完成登录...", "info");

    var controller = new AbortController();
    var timeoutId = setTimeout(function() {
        controller.abort();
        addLog("获取 Cookie 超时，请检查浏览器登录状态", "warn");
        setStatus("获取超时", "error");
    }, 130000);

    fetch("/api/login/open_browser", { signal: controller.signal })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            clearTimeout(timeoutId);
            if (data.success && data.cookie) {
                document.getElementById("cookie").value = data.cookie;
                addLog("Cookie 已自动填充到输入框", "success");
                setStatus("Cookie 获取成功", "success");
                var ta = document.getElementById("cookie");
                if (ta) ta.classList.remove("collapsed");
            } else {
                addLog("获取 Cookie 失败: " + (data.message || "未知错误"), "error");
                setStatus("Cookie 获取失败", "error");
            }
        })
        .catch(function(err) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") return;
            addLog("请求失败: " + err.message, "error");
            setStatus("请求失败", "error");
        })
        .finally(function() {
            btn.disabled = false;
            btn.textContent = "🌐 浏览器登录获取";
        });
}

window.openBrowserLogin = openBrowserLogin;
