from __future__ import annotations

import os
import sys

from flask import Flask

from config import Config
from logging_config import setup_logging
from error_handlers import register_error_handlers


def get_resource_path(relative_path: str) -> str:
    """获取资源绝对路径，兼容 PyInstaller 打包。"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(getattr(sys, "_MEIPASS"), relative_path)
    return os.path.join(os.path.abspath(os.path.dirname(__file__)), relative_path)


def create_app(config_class=Config) -> Flask:
    """应用工厂。"""
    setup_logging()

    template_dir = get_resource_path("ui/templates")
    static_dir = get_resource_path("ui/static")

    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    app.config.from_object(config_class)

    # 注册 Blueprint
    from api_routes.page_routes import page_bp
    from api_routes.recharge import recharge_bp
    from api_routes.suspend import suspend_bp
    from api_routes.resume import resume_bp
    from api_routes.cancel import cancel_bp
    from api_routes.cancel_account import cancel_account_bp
    from api_routes.balance import balance_bp
    from api_routes.cdr import cdr_bp
    from api_routes.sql import sql_bp
    from api_routes.login_helper import login_bp

    app.register_blueprint(page_bp)
    app.register_blueprint(recharge_bp)
    app.register_blueprint(suspend_bp)
    app.register_blueprint(resume_bp)
    app.register_blueprint(cancel_bp)
    app.register_blueprint(cancel_account_bp)
    app.register_blueprint(balance_bp)
    app.register_blueprint(cdr_bp)
    app.register_blueprint(sql_bp)
    app.register_blueprint(login_bp)

    # 注册错误处理
    register_error_handlers(app)

    return app
