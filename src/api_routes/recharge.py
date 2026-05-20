from __future__ import annotations

from decimal import Decimal

from flask import Blueprint, request, jsonify

from core.services.recharge_service import RechargeService, RechargeOptions
from core.result_serializers import serialize_recharge_result
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

recharge_bp = Blueprint("recharge", __name__, url_prefix="/api/recharge")
service = RechargeService()


def _build_options(payload: dict) -> RechargeOptions | str:
    dry_run = bool(payload.get("dry_run", False))
    max_gift_amount_raw = payload.get("max_gift_amount")
    bill_sleep_s = float(payload.get("bill_sleep_s", 0.3) or 0)
    after_gift_sleep_s = float(payload.get("after_gift_sleep_s", 0.5) or 0)

    max_gift_amount = None
    if max_gift_amount_raw not in (None, ""):
        try:
            max_gift_amount = Decimal(str(max_gift_amount_raw))
        except Exception:
            return "max_gift_amount 格式不正确"
    return RechargeOptions(
        dry_run=dry_run,
        max_gift_amount=max_gift_amount,
        bill_sleep_s=bill_sleep_s,
        after_gift_sleep_s=after_gift_sleep_s,
    )


def _process(cookie: str, phones: list[str], payload: dict):
    options = _build_options(payload)
    if isinstance(options, str):
        return jsonify({"success": False, "message": options}), 400
    results = service.process_phones(phones=phones, cookie=cookie, options=options)
    rows = [serialize_recharge_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@recharge_bp.post("/process")
def process_recharge():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _process(cookie, phones, payload)


@recharge_bp.post("/process_one")
def process_recharge_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    return _process(cookie, [phone], payload)
