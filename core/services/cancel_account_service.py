from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from ..api.bossweb_client import BossWebClient
from ..api.recharge_api import RechargeApi, BalanceInfo
from ..base import BatchPhoneService


@dataclass(frozen=True)
class CancelAccountCheckResult:
    phone: str
    balance: Decimal | None
    can_cancel: bool


class CancelAccountService(BatchPhoneService):
    def __init__(self, api: RechargeApi | None = None, client: BossWebClient | None = None) -> None:
        self._api = api or RechargeApi()
        self._client = client or BossWebClient()

    def _error_result(self, *, phone: str, error: Exception) -> CancelAccountCheckResult:
        return CancelAccountCheckResult(
            phone=phone,
            balance=None,
            can_cancel=False,
        )

    def check_single_phone(self, *, phone: str, cookie: str) -> CancelAccountCheckResult:
        balance_info = self._api.get_balance(phone=phone, cookie=cookie)
        balance = balance_info.balance
        can_cancel = balance is not None and balance >= Decimal("0")
        return CancelAccountCheckResult(
            phone=phone,
            balance=balance,
            can_cancel=can_cancel,
        )

    def check_phones(self, *, phones: list[str], cookie: str) -> list[CancelAccountCheckResult]:
        return self.process_phones(phones=phones, cookie=cookie)

    def process_single_phone(self, *, phone: str, cookie: str, **kwargs) -> CancelAccountCheckResult:
        return self.check_single_phone(phone=phone, cookie=cookie)

    def get_can_cancel_phones(self, *, results: list[CancelAccountCheckResult]) -> list[str]:
        return [r.phone for r in results if r.can_cancel]
