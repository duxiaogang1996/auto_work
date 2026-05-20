from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from ..api.bossweb_client import BossWebClient
from ..api.recharge_api import RechargeApi, BalanceInfo
from ..base import BatchPhoneService


@dataclass(frozen=True)
class ResumeProcessResult:
    phone: str
    balance: Decimal | None
    plan_name: str | None
    user_status: str | None
    can_resume: bool
    message: str
    resume_requested: bool
    resume_success: bool | None
    resume_message: str | None


class ResumeService(BatchPhoneService):
    def __init__(self, api: RechargeApi | None = None, client: BossWebClient | None = None) -> None:
        self._api = api or RechargeApi()
        self._client = client or BossWebClient()

    def _error_result(self, *, phone: str, error: Exception) -> ResumeProcessResult:
        return ResumeProcessResult(
            phone=phone,
            balance=None,
            plan_name=None,
            user_status=None,
            can_resume=False,
            message=f"查询失败：{error}",
            resume_requested=False,
            resume_success=None,
            resume_message=None,
        )

    def _infer_reason_code(self, plan_name: str | None) -> str:
        from .reason_codes import ResumeReasonCodes
        return ResumeReasonCodes.infer(plan_name)

    def _infer_tele_type(self, plan_name: str | None) -> str:
        if plan_name and "电信" in plan_name:
            return "CTC"
        if plan_name and "联通" in plan_name:
            return "GSM"
        return "GSM"

    def process_single_phone(self, *, phone: str, cookie: str, auto_resume: bool, remark: str = "") -> ResumeProcessResult:
        try:
            balance_info = self._api.get_balance(phone=phone, cookie=cookie)
            balance = balance_info.balance
            plan_name = balance_info.plan_name
            user_status = balance_info.user_status

            can_resume = (balance is not None and balance >= Decimal("0")) and user_status == "局方停机"
            if can_resume:
                message = "余额充足且状态为局方停机，可开机"
            else:
                if balance is None or balance < Decimal("0"):
                    message = "余额不足，不能开机"
                else:
                    if user_status != "局方停机":
                        message = f"当前状态为[{user_status}]，不是局方停机，不能开机"
                    else:
                        message = "不符合开机条件，不能开机"

            resume_requested = False
            resume_success: bool | None = None
            resume_message: str | None = None

            if can_resume and auto_resume:
                resume_requested = True
                reason_code = self._infer_reason_code(plan_name)
                tele_type = self._infer_tele_type(plan_name)
                use_remark = remark or "企业方开机-余额充足开机"
                resp = self._client.api6_deal_open_close(
                    phone=phone,
                    reason_code=reason_code,
                    tele_type=tele_type,
                    remark=use_remark,
                    cookie=cookie,
                )
                resp_type = str(resp.get("type") or "")
                resp_content = str(resp.get("content") or "")
                resume_success = resp_type == "success"
                resume_message = resp_content or resp_type
                if resume_success:
                    message = "开机成功"
                else:
                    message = "开机失败"

            return ResumeProcessResult(
                phone=phone,
                balance=balance,
                plan_name=plan_name,
                user_status=user_status,
                can_resume=can_resume,
                message=message,
                resume_requested=resume_requested,
                resume_success=resume_success,
                resume_message=resume_message,
            )
        except Exception as e:
            return ResumeProcessResult(
                phone=phone,
                balance=None,
                plan_name=None,
                user_status=None,
                can_resume=False,
                message=f"查询失败：{e}",
                resume_requested=False,
                resume_success=None,
                resume_message=None,
            )

    pass
