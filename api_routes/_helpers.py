from __future__ import annotations

from flask import request, jsonify


def parse_cookie_and_phones(payload: dict | None) -> tuple[str | None, list[str] | None, tuple | None]:
    """从请求体中提取并校验 cookie 和手机号列表。
    返回 (cookie, phones) 或 (None, None, 错误响应)。
    """
    payload = payload or {}
    from core.utils import normalize_cookie, parse_phones
    cookie = normalize_cookie(payload.get("cookie"))
    phones_text = str(payload.get("phones") or "")
    if not cookie:
        return None, None, ({"success": False, "message": "Cookie 不能为空"}, 400)
    phones = parse_phones(phones_text)
    if not phones:
        return None, None, ({"success": False, "message": "手机号列表不能为空"}, 400)
    return cookie, phones, None


def parse_cookie_and_phone(payload: dict | None) -> tuple[str | None, str | None, tuple | None]:
    """从请求体中提取并校验 cookie 和单个手机号。
    返回 (cookie, phone) 或 (None, None, 错误响应)。
    """
    payload = payload or {}
    from core.utils import normalize_cookie
    cookie = normalize_cookie(payload.get("cookie"))
    phone = str(payload.get("phone") or "").strip()
    if not cookie:
        return None, None, ({"success": False, "message": "Cookie 不能为空"}, 400)
    if not phone:
        return None, None, ({"success": False, "message": "手机号不能为空"}, 400)
    return cookie, phone, None
