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

# 淘宝 npmmirror 镜像地址，替代被墙的 Google 存储
CHROMEDRIVER_MIRROR = "https://registry.npmmirror.com/-/binary/chromedriver"


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


def _get_chrome_major_version() -> str | None:
    """获取本机 Chrome 主版本号。"""
    try:
        if platform.system() == "Windows":
            import subprocess
            result = subprocess.run(
                ["reg", "query", "HKEY_CURRENT_USER\\Software\\Google\\Chrome\\BLBeacon", "/v", "version"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                return result.stdout.strip().split()[-1].split(".")[0]
        elif platform.system() == "Darwin":
            import subprocess
            result = subprocess.run(
                ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                return result.stdout.strip().split()[-1].split(".")[0]
    except Exception:
        pass
    return None


def _download_chromedriver_from_mirror() -> str | None:
    """从淘宝镜像下载 chromedriver，返回驱动路径或 None。"""
    major = _get_chrome_major_version()
    if not major:
        return None

    import requests
    import zipfile
    import tempfile

    cache_dir = os.path.join(os.path.expanduser("~"), ".chromedriver")
    os.makedirs(cache_dir, exist_ok=True)

    driver_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"

    # 检查缓存
    cached = os.path.join(cache_dir, f"{major}", driver_name)
    if os.path.exists(cached):
        return cached

    try:
        # Chrome 115+ 使用 Chrome for Testing JSON API
        if int(major) >= 115:
            json_url = "https://registry.npmmirror.com/-/binary/chrome-for-testing/known-good-versions-with-downloads.json"
            resp = requests.get(json_url, timeout=15)
            import json
            data = json.loads(resp.text)

            # 找到匹配的主版本号最新版本
            matched = [v for v in data["versions"] if v["version"].startswith(f"{major}.")]
            if not matched:
                return None
            latest = matched[-1]
            downloads = latest["downloads"].get("chromedriver", [])

            # 选择对应平台的下载链接
            plat = platform.system()
            arch = platform.machine()
            if plat == "Windows":
                platform_key = "win64"
            elif plat == "Darwin" and arch == "arm64":
                platform_key = "mac-arm64"
            elif plat == "Darwin":
                platform_key = "mac-x64"
            else:
                platform_key = "linux64"

            dl_url = None
            for d in downloads:
                if d["platform"] == platform_key:
                    dl_url = d["url"]
                    break

            if not dl_url:
                return None

            # 下载并解压
            zip_path = os.path.join(tempfile.gettempdir(), f"chromedriver_{major}.zip")
            with requests.get(dl_url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(zip_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            extract_dir = os.path.join(cache_dir, major)
            os.makedirs(extract_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zf:
                # Chrome for Testing 的 zip 内目录结构: chromedriver-<plat>/chromedriver
                for name in zf.namelist():
                    if name.endswith(driver_name):
                        with zf.open(name) as src, open(cached, "wb") as dst:
                            dst.write(src.read())
                        break

            os.remove(zip_path)
            if os.path.exists(cached):
                if platform.system() != "Windows":
                    os.chmod(cached, 0o755)
                return cached

        else:
            # Chrome 114 及以下使用旧版镜像
            filename = "chromedriver_win32.zip" if platform.system() == "Windows" else (
                "chromedriver_mac64.zip" if platform.system() == "Darwin" else "chromedriver_linux64.zip"
            )
            zip_url = f"{CHROMEDRIVER_MIRROR}/{major}/{filename}"
            zip_path = os.path.join(tempfile.gettempdir(), f"chromedriver_{major}.zip")

            with requests.get(zip_url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(zip_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            extract_dir = os.path.join(cache_dir, major)
            os.makedirs(extract_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(extract_dir)

            os.remove(zip_path)
            if os.path.exists(cached):
                if platform.system() != "Windows":
                    os.chmod(cached, 0o755)
                return cached

    except Exception:
        pass

    return None


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
    driver = None

    # 优先使用本地 chromedriver
    driver_path = _find_chromedriver()
    if driver_path:
        service = Service(driver_path)
    else:
        # 本地没有时，从淘宝镜像下载
        driver_path = _download_chromedriver_from_mirror()
        if driver_path:
            service = Service(driver_path)
        else:
            # 最后尝试 webdriver-manager（可能因网络失败）
            try:
                from webdriver_manager.chrome import ChromeDriverManager
                service = Service(ChromeDriverManager().install())
            except ImportError:
                return None, (
                    "未找到 chromedriver，请手动安装：\n"
                    "1. 下载 https://registry.npmmirror.com/-/binary/chromedriver/\n"
                    "2. 或运行: pip install webdriver-manager"
                )
            except Exception as e:
                return None, (
                    f"自动下载 chromedriver 失败: {e}\n"
                    "请手动下载驱动并放到 PATH 中，或检查网络后重试"
                )

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


def _format_cookies(cookies: list[dict]) -> str:
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


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
