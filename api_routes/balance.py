from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.balance_service import BalanceService
from core.result_serializers import serialize_balance_simple_result, serialize_balance_ledger_result
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

balance_bp = Blueprint("balance", __name__, url_prefix="/api/balance")
balance_service = BalanceService()


@balance_bp.post("/query")
def query_balance():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    mode = str(payload.get("mode") or "simple").strip().lower()

    if mode == "ledger":
        detail_rows = balance_service.query_ledger_phones(phones=phones, cookie=cookie)
        rows = [serialize_balance_ledger_result(r) for r in detail_rows]
    else:
        results = balance_service.query_simple_phones(phones=phones, cookie=cookie, bill_yyyymm_fallback=None)
        rows = [serialize_balance_simple_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@balance_bp.post("/query_one")
def query_balance_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    mode = str(payload.get("mode") or "simple").strip().lower()
    bill_yyyymm = payload.get("bill_yyyymm")

    if mode == "ledger":
        base, detail_rows = balance_service.query_ledger_single(phone=phone, cookie=cookie)
        rows = [serialize_balance_ledger_result(r) for r in detail_rows]
        if not rows:
            rows = [
                {
                    "phone": base.phone,
                    "plan_name": base.plan_name,
                    "user_status": base.user_status,
                    "active_time": base.active_time,
                    "balance": None if base.balance is None else str(base.balance),
                    "owe_amount": None,
                    "item_type": "",
                    "item_name": "",
                    "amount": "",
                    "unit": None,
                    "eff_date": None,
                    "exp_date": None,
                    "message": base.message,
                }
            ]
    else:
        bill_yyyymm_val = str(bill_yyyymm).strip() if bill_yyyymm else None
        r = balance_service.query_simple_single(phone=phone, cookie=cookie, bill_yyyymm_fallback=bill_yyyymm_val or None)
        rows = [serialize_balance_simple_result(r)]
    return jsonify({"success": True, "data": rows})
