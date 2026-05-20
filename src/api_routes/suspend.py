from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.suspend_service import SuspendService
from core.result_serializers import serialize_suspend_result
from core.export_utils import export_csv, parse_data_json
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

suspend_bp = Blueprint("suspend", __name__, url_prefix="/api/suspend")
suspend_service = SuspendService()


def _process(cookie: str, phones: list[str], auto_suspend: bool):
    results = suspend_service.process_phones(phones=phones, cookie=cookie, auto_suspend=auto_suspend)
    rows = [serialize_suspend_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@suspend_bp.post("/process")
def process_suspend():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_suspend = bool(payload.get("auto_suspend", True))
    return _process(cookie, phones, auto_suspend)


@suspend_bp.post("/process_one")
def process_suspend_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_suspend = bool(payload.get("auto_suspend", True))
    return _process(cookie, [phone], auto_suspend)


@suspend_bp.post("/export")
def export_suspend():
    data = parse_data_json() or []
    phones = [item.get("phone") for item in data if item.get("should_suspend")]
    return export_csv([p for p in phones if p], filename="停机.csv")
