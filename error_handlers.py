from __future__ import annotations

import logging

from flask import Flask, jsonify


logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """注册全局错误处理器，统一返回 JSON 格式。"""

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "message": "请求参数错误"}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "message": "接口不存在"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "message": "服务器内部错误"}), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error("未捕获异常: %s", e, exc_info=True)
        return jsonify({"success": False, "message": f"服务异常: {e}"}), 500
