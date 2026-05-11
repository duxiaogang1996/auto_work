from __future__ import annotations

import os
import platform
import shutil
import threading
import time

from flask import Blueprint, jsonify

login_bp = Blueprint("login", __name__, url_prefix="/api/login")

_lock = threading.Lock()
_in_progress = False

LOGIN_URL = "http://bossweb.jd.com/cas/login"
LOGIN_TIMEOUT = 120


def _find_chromedriver() -> str | None:
    """查找 chromedriver 可执行文件路径，支持 Windows/macOS/Linux。"""
    driver_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"
    paths = [shutil.which(driver_name)]
    if platform.system() == "Darwin":
        paths.extend(["/opt/homebrew/bin/chromedriver", "/usr/local/bin/chromedriver"])
    elif platform.system() == "Windows":
        paths.extend([
            os.path.join(os.environ.get("ProgramFiles", ""), "Google\\Chrome\\chromedriver.exe"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google\\Chrome\\chromedriver.exe"),
        ])
    for p in paths:
        if p and os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def _format_cookies(cookies: list[dict]) -> str:
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


def _run_browser_login(login_url: str, timeout: int = 120) -> tuple[str | None, str | None]:
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
    except ImportError:
        return None, "未安装 selenium，请运行: pip install selenium"

    opts = Options()
    # 不设置 headless，让用户能看到登录页面
    driver = None

    # 优先从本地路径查找 chromedriver
    driver_path = _find_chromedriver()
    if driver_path:
        service = Service(driver_path)
    else:
        # 本地找不到时，尝试用 webdriver-manager 自动下载
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
        except ImportError:
            return None, "未找到 chromedriver 且未安装 webdriver-manager。\n请运行: pip install webdriver-manager"
        except Exception as e:
            return None, f"webdriver-manager 下载驱动失败: {e}"

    try:
        driver = webdriver.Chrome(service=service, options=opts)
        driver.get(login_url)
        WebDriverWait(driver, timeout).until(EC.url_changes(login_url))
        time.sleep(1)
        return _format_cookies(driver.get_cookies()), None
    except Exception as e:
        return None, f"获取 Cookie 失败: {e}"
    finally:
        if driver:
            driver.quit()


@login_bp.route("/open_browser")
def open_browser():
    global _in_progress
    with _lock:
        if _in_progress:
            return jsonify({"success": False, "message": "已有登录流程正在进行中，请等待完成后再试"}), 400
        _in_progress = True

    cookie, error = _run_browser_login(LOGIN_URL, LOGIN_TIMEOUT)

    with _lock:
        _in_progress = False

    if error:
        return jsonify({"success": False, "message": error}), 500

    return jsonify({"success": True, "cookie": cookie})


@login_bp.route("/status")
def login_status():
    with _lock:
        status = _in_progress
    return jsonify({"in_progress": status})
