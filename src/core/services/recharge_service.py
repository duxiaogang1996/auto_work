from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import time
from typing import Any

from ..base import BatchPhoneService
from ..api.recharge_api import RechargeApi


_CENT = Decimal("0.01")


def _round_money(x: Decimal) -> Decimal:
    return x.quantize(_CENT, rounding=ROUND_HALF_UP)


def _effdate_to_yyyymm(eff_date: str) -> str:
    s = (eff_date or "").strip()
    if len(s) >= 7:
        y = s[0:4]
        m = s[5:7]
        if y.isdigit() and m.isdigit():
            return f"{y}{m}"
    return ""


def _build_reason(months_yyyymm: list[str]) -> str:
    uniq = []
    seen = set()
    for m in months_yyyymm:
        if m and m not in seen:
            uniq.append(m)
            seen.add(m)
    return f"补赠{','.join(uniq)}月话费"

def _active_time_to_start_date(active_time: str | None) -> str | None:
    if not active_time:
        return None
    s = str(active_time).strip()
    if len(s) >= 10:
        d = s[:10]
        if len(d) == 10 and d[4] == "-" and d[7] == "-":
            return d
    return None


@dataclass(frozen=True)
class PhoneProcessResult:
    phone: str
    unreturned_months: list[str]
    total_deduct: Decimal
    gifted_amount: Decimal
    final_gift_amount: Decimal
    balance_before: Decimal | None
    balance_after: Decimal | None
    balance_diff: Decimal | None
    gift_success: bool | None
    validate_ok: bool | None
    message: str
    details: dict[str, Any]


@dataclass(frozen=True)
class RechargeOptions:
    dry_run: bool = False
    max_gift_amount: Decimal | None = None
    gift_query_start_date: str | None = None
    bill_sleep_s: float = 0.3
    after_gift_sleep_s: float = 0.5


class RechargeService(BatchPhoneService):
    def __init__(self, api: RechargeApi | None = None) -> None:
        super().__init__(batch_delay=0.2)
        self._api = api or RechargeApi()

    def process_single_phone(self, *, phone: str, cookie: str, **kwargs) -> PhoneProcessResult:
        options: RechargeOptions | None = kwargs.get("options")
        opt = options or RechargeOptions()
        unreturned_records = self._api.get_unreturned_month_records(phone=phone, cookie=cookie)
        months_raw: list[str] = []
        for r in unreturned_records:
            m = _effdate_to_yyyymm(r.eff_date)
            if m:
                months_raw.append(m)

        months: list[str] = sorted(set(months_raw))

        if not months:
            return PhoneProcessResult(
                phone=phone,
                unreturned_months=[],
                total_deduct=Decimal("0"),
                gifted_amount=Decimal("0"),
                final_gift_amount=Decimal("0"),
                balance_before=None,
                balance_after=None,
                balance_diff=None,
                gift_success=None,
                validate_ok=None,
                message="无未返还月份（无需处理）",
                details={"unreturned_records": [r.__dict__ for r in unreturned_records]},
            )

        bill_summaries = []
        total_deduct = Decimal("0")
        for yyyymm in months:
            bill = self._api.get_bill_total_deduct(phone=phone, bill_yyyymm=yyyymm, cookie=cookie)
            bill_summaries.append({"bill_yyyymm": bill.bill_yyyymm, "total_deduct": str(bill.total_deduct)})
            total_deduct += bill.total_deduct
            if opt.bill_sleep_s > 0:
                time.sleep(opt.bill_sleep_s)

        balance_before_info = self._api.get_balance(phone=phone, cookie=cookie)
        start_date = (
            opt.gift_query_start_date
            or _active_time_to_start_date(balance_before_info.active_time)
            or (date.today() - timedelta(days=365)).strftime("%Y-%m-%d")
        )
        end_date = date.today().strftime("%Y-%m-%d")
        gifted_amount, gifted_rows = self._api.get_gifted_amount(phone=phone, start_date=start_date, end_date=end_date, cookie=cookie)

        final_gift_amount = _round_money(_round_money(total_deduct) - _round_money(gifted_amount))
        if final_gift_amount <= 0:
            return PhoneProcessResult(
                phone=phone,
                unreturned_months=months,
                total_deduct=_round_money(total_deduct),
                gifted_amount=_round_money(gifted_amount),
                final_gift_amount=final_gift_amount,
                balance_before=None,
                balance_after=None,
                balance_diff=None,
                gift_success=None,
                validate_ok=None,
                message="已赠费金额已覆盖扣款（无需赠费）",
                details={
                    "bills": bill_summaries,
                    "gifted_rows": gifted_rows,
                    "gift_query_start": start_date,
                    "gift_query_end": end_date,
                    "active_time": balance_before_info.active_time,
                },
            )

        balance_before = _round_money(balance_before_info.balance)

        reason = _build_reason(months)
        if opt.max_gift_amount is not None and final_gift_amount > opt.max_gift_amount:
            return PhoneProcessResult(
                phone=phone,
                unreturned_months=months,
                total_deduct=_round_money(total_deduct),
                gifted_amount=_round_money(gifted_amount),
                final_gift_amount=final_gift_amount,
                balance_before=balance_before,
                balance_after=None,
                balance_diff=None,
                gift_success=None,
                validate_ok=None,
                message="赠费金额超过阈值（未下发）",
                details={
                    "bills": bill_summaries,
                    "gifted_rows": gifted_rows,
                    "plan_name": balance_before_info.plan_name,
                    "user_status": balance_before_info.user_status,
                    "gift_query_start": start_date,
                    "gift_query_end": end_date,
                    "active_time": balance_before_info.active_time,
                    "reason": reason,
                    "max_gift_amount": str(opt.max_gift_amount),
                },
            )

        if opt.dry_run:
            return PhoneProcessResult(
                phone=phone,
                unreturned_months=months,
                total_deduct=_round_money(total_deduct),
                gifted_amount=_round_money(gifted_amount),
                final_gift_amount=final_gift_amount,
                balance_before=balance_before,
                balance_after=None,
                balance_diff=None,
                gift_success=None,
                validate_ok=None,
                message="已计算（未下发）",
                details={
                    "bills": bill_summaries,
                    "gifted_rows": gifted_rows,
                    "plan_name": balance_before_info.plan_name,
                    "user_status": balance_before_info.user_status,
                    "gift_query_start": start_date,
                    "gift_query_end": end_date,
                    "active_time": balance_before_info.active_time,
                    "reason": reason,
                    "dry_run": True,
                },
            )

        gift_success = self._api.send_charge(phone=phone, amount=final_gift_amount, reason=reason, cookie=cookie)
        if opt.after_gift_sleep_s > 0:
            time.sleep(opt.after_gift_sleep_s)

        balance_after_info = self._api.get_balance(phone=phone, cookie=cookie)
        balance_after = _round_money(balance_after_info.balance)
        diff = _round_money(balance_after - balance_before)
        validate_ok = abs(diff - final_gift_amount) < _CENT

        return PhoneProcessResult(
            phone=phone,
            unreturned_months=months,
            total_deduct=_round_money(total_deduct),
            gifted_amount=_round_money(gifted_amount),
            final_gift_amount=final_gift_amount,
            balance_before=balance_before,
            balance_after=balance_after,
            balance_diff=diff,
            gift_success=gift_success,
            validate_ok=validate_ok,
            message="完成",
            details={
                "bills": bill_summaries,
                "gifted_rows": gifted_rows,
                "plan_name": balance_before_info.plan_name,
                "user_status": balance_before_info.user_status,
                "gift_query_start": start_date,
                "gift_query_end": end_date,
                "active_time": balance_before_info.active_time,
                "reason": reason,
            },
        )

    def _error_result(self, *, phone: str, error: Exception) -> "PhoneProcessResult":
        return PhoneProcessResult(
            phone=phone,
            unreturned_months=[],
            total_deduct=Decimal("0"),
            gifted_amount=Decimal("0"),
            final_gift_amount=Decimal("0"),
            balance_before=None,
            balance_after=None,
            balance_diff=None,
            gift_success=None,
            validate_ok=None,
            message=f"失败：{error}",
            details={},
        )
