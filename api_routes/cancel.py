from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.order_cancel_service import OrderCancelService
from core.result_serializers import serialize_cancel_result
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

cancel_bp = Blueprint("cancel", __name__, url_prefix="/api/cancel")


def _process_cookie_phones(cookie: str, phones: list[str]):
    service = OrderCancelService()
    results = service.process(cookie=cookie, phones=phones)
    data = [serialize_cancel_result(r) for r in results]
    return jsonify({"success": True, "data": data})


@cancel_bp.post("/process")
def process_cancel():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _process_cookie_phones(cookie, phones)


@cancel_bp.post("/process_one")
def process_cancel_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _process_cookie_phones(cookie, [phone])
