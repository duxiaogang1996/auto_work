from __future__ import annotations

from decimal import Decimal


def _safe_str(v: object) -> str | None:
    if v is None:
        return None
    return str(v)


def serialize_recharge_result(r) -> dict:
    return {
        "phone": r.phone,
        "unreturned_months": r.unreturned_months,
        "total_deduct": _safe_str(r.total_deduct),
        "gifted_amount": _safe_str(r.gifted_amount),
        "final_gift_amount": _safe_str(r.final_gift_amount),
        "balance_before": _safe_str(r.balance_before),
        "balance_after": _safe_str(r.balance_after),
        "balance_diff": _safe_str(r.balance_diff),
        "gift_success": r.gift_success,
        "validate_ok": r.validate_ok,
        "message": r.message,
        "details": r.details,
    }


def serialize_cancel_result(r) -> dict:
    return {
        "phone": r.phone,
        "query_type": r.query_type,
        "query_content": r.query_content,
        "can_cancel": r.can_cancel,
        "user_status": r.user_status,
        "order_status": r.order_status,
        "jd_order_id": r.jd_order_id,
        "cancel_type": r.cancel_type,
        "cancel_content": r.cancel_content,
    }


def serialize_suspend_result(r) -> dict:
    status_text = r.user_status or ""
    if r.user_status != "在用":
        if r.user_status:
            status_text = f"{r.user_status}（不能停机）"
        else:
            status_text = "未知状态（不能停机）"
    else:
        if r.suspend_requested:
            if r.suspend_success is True:
                status_text = "在用（停机成功）"
            elif r.suspend_success is False:
                detail = r.suspend_message or "失败"
                status_text = f"在用（停机失败：{detail}）"
            else:
                status_text = "在用（已请求停机）"
        else:
            status_text = "在用（未停机）"
    return {
        "phone": r.phone,
        "status": status_text,
        "should_suspend": r.should_suspend,
    }


def serialize_resume_result(r) -> dict:
    return {
        "phone": r.phone,
        "balance": _safe_str(r.balance),
        "plan_name": r.plan_name,
        "user_status": r.user_status,
        "can_resume": r.can_resume,
        "message": r.message,
        "resume_requested": r.resume_requested,
        "resume_success": r.resume_success,
        "resume_message": r.resume_message,
    }


def serialize_cancel_account_result(r) -> dict:
    return {
        "phone": r.phone,
        "balance": _safe_str(r.balance),
        "can_cancel": r.can_cancel,
    }


def serialize_balance_simple_result(r) -> dict:
    return {
        "phone": r.phone,
        "balance": _safe_str(r.balance),
        "plan_name": r.plan_name,
        "user_status": r.user_status,
        "active_time": r.active_time,
        "owe_amount": _safe_str(r.owe_amount),
        "message": r.message,
    }


def serialize_balance_ledger_result(r) -> dict:
    return {
        "phone": r.phone,
        "plan_name": r.plan_name,
        "user_status": r.user_status,
        "active_time": r.active_time,
        "balance": _safe_str(r.balance),
        "owe_amount": _safe_str(r.owe_amount),
        "item_type": r.item_type,
        "item_name": r.item_name,
        "amount": r.amount,
        "unit": r.unit,
        "eff_date": r.eff_date,
        "exp_date": r.exp_date,
        "message": r.message,
    }


def serialize_cdr_result(r, phone: str) -> dict:
    return {
        "start_time": r.start_time,
        "call_type": r.call_type,
        "called_number": r.called_number,
        "charge": _safe_str(r.charge),
        "roma_type": r.roma_type,
        "phone": phone,
    }
