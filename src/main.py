from __future__ import annotations

import os
import threading
import time
import webbrowser

from app_factory import create_app


def open_browser(port: int) -> None:
    """延迟打开浏览器。"""
    time.sleep(1.5)
    webbrowser.open(f"http://127.0.0.1:{port}")


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", "5000"))

    if not os.environ.get("WERKZEUG_RUN_MAIN"):
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    app.run(host="127.0.0.1", port=port)
