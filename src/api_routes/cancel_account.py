from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request, jsonify

from core.services.cancel_account_service import CancelAccountService
from core.result_serializers import serialize_cancel_account_result
from core.export_utils import export_xls, parse_data_json
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

cancel_account_bp = Blueprint("cancel_account", __name__, url_prefix="/api/cancel_account")
cancel_account_service = CancelAccountService()


def _check(cookie: str, phones: list[str]):
    results = cancel_account_service.check_phones(phones=phones, cookie=cookie)
    rows = [serialize_cancel_account_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@cancel_account_bp.post("/check")
def check_cancel_account():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _check(cookie, phones)


@cancel_account_bp.post("/check_one")
def check_cancel_account_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _check(cookie, [phone])


@cancel_account_bp.post("/export_xls")
def export_cancel_account_xls():
    data = parse_data_json() or []
    phones = [item.get("phone") for item in data if item.get("can_cancel")]
    today = datetime.now().strftime("%Y%m%d")
    return export_xls([p for p in phones if p], filename=f"{today}销户号码.xls")
