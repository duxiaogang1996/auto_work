from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from ..api.recharge_api import RechargeApi
from ..api.bossweb_client import BossWebClient
from ..base import BatchPhoneService


@dataclass(frozen=True)
class SuspendProcessResult:
    phone: str
    balance: Decimal | None
    plan_name: str | None
    plan_amount: Decimal | None
    user_status: str | None
    should_suspend: bool
    message: str
    suspend_requested: bool
    suspend_success: bool | None
    suspend_message: str | None


class SuspendService(BatchPhoneService):
    def __init__(self, api: RechargeApi | None = None, client: BossWebClient | None = None) -> None:
        self._api = api or RechargeApi()
        self._client = client or BossWebClient()

    def _error_result(self, *, phone: str, error: Exception) -> SuspendProcessResult:
        return SuspendProcessResult(
            phone=phone,
            balance=None,
            plan_name=None,
            plan_amount=None,
            user_status=None,
            should_suspend=False,
            message=f"查询失败：{error}",
            suspend_requested=False,
            suspend_success=None,
            suspend_message=None,
        )

    def _extract_plan_amount(self, plan_name: str | None) -> Decimal | None:
        if not plan_name:
            return None
        # Extract the first number found in the plan name (e.g., "1元年卡" -> 1)
        match = re.search(r"(\d+(?:\.\d+)?)", plan_name)
        if match:
            return Decimal(match.group(1))
        return None

    def _infer_reason_code(self, plan_name: str | None) -> str:
        if plan_name and "电信" in plan_name:
            return "80"
        if plan_name and "联通" in plan_name:
            return "90"
        return "90"

    def process_single_phone(self, *, phone: str, cookie: str, auto_suspend: bool) -> SuspendProcessResult:
        try:
            balance_info = self._api.get_balance(phone=phone, cookie=cookie)
            balance = balance_info.balance
            plan_name = balance_info.plan_name
            user_status = balance_info.user_status

            plan_amount = self._extract_plan_amount(plan_name)
            is_in_use = user_status == "在用"
            has_valid_amount = balance is not None and plan_amount is not None
            should_suspend = bool(is_in_use and has_valid_amount and balance < plan_amount)

            if not is_in_use:
                message = f"当前状态为[{user_status}]，不能停机"
            elif not has_valid_amount:
                message = "无法判断是否可停机（余额或套餐金额缺失）"
            else:
                message = "余额小于套餐金额且状态在用，可停机" if should_suspend else "余额不低于套餐金额，不能停机"
            suspend_requested = False
            suspend_success: bool | None = None
            suspend_message: str | None = None

            if should_suspend and auto_suspend:
                suspend_requested = True
                reason_code = self._infer_reason_code(plan_name)
                remark = "企业方停机-不满下月月租停机"
                resp = self._client.api6_deal_open_close(
                    phone=phone,
                    reason_code=reason_code,
                    tele_type="GSM",
                    remark=remark,
                    cookie=cookie,
                )
                resp_type = str(resp.get("type") or "")
                resp_content = str(resp.get("content") or "")
                suspend_success = resp_type == "success"
                suspend_message = resp_content or resp_type
                if suspend_success:
                    message = "停机成功"
                else:
                    message = "停机失败"
            elif should_suspend and not auto_suspend:
                message = "在用（未执行停机）"

            return SuspendProcessResult(
                phone=phone,
                balance=balance,
                plan_name=plan_name,
                plan_amount=plan_amount,
                user_status=user_status,
                should_suspend=should_suspend,
                message=message,
                suspend_requested=suspend_requested,
                suspend_success=suspend_success,
                suspend_message=suspend_message,
            )
        except Exception as e:
            return SuspendProcessResult(
                phone=phone,
                balance=None,
                plan_name=None,
                plan_amount=None,
                user_status=None,
                should_suspend=False,
                message=f"查询失败：{e}",
                suspend_requested=False,
                suspend_success=None,
                suspend_message=None,
            )

    pass
