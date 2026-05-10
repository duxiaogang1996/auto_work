from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime

from ..api.recharge_api import RechargeApi
from ..base import BatchPhoneService


@dataclass(frozen=True)
class BalanceQueryResult:
    phone: str
    balance: Decimal | None
    plan_name: str | None
    user_status: str | None
    active_time: str | None
    owe_amount: Decimal | None
    message: str


@dataclass(frozen=True)
class BalanceLedgerRow:
    phone: str
    plan_name: str | None
    user_status: str | None
    active_time: str | None
    balance: Decimal | None
    owe_amount: Decimal | None
    item_type: str
    item_name: str
    amount: str
    unit: str | None
    eff_date: str | None
    exp_date: str | None
    message: str


def _current_yyyymm() -> str:
    return datetime.today().strftime("%Y%m")


class BalanceService(BatchPhoneService):
    def __init__(self, api: RechargeApi | None = None) -> None:
        self._api = api or RechargeApi()

    def _error_result(self, *, phone: str, error: Exception) -> BalanceQueryResult:
        return BalanceQueryResult(
            phone=phone,
            balance=None,
            plan_name=None,
            user_status="查询失败",
            active_time=None,
            owe_amount=None,
            message=f"查询失败：{error}",
        )

    def query_simple_single(self, *, phone: str, cookie: str, bill_yyyymm_fallback: str | None = None) -> BalanceQueryResult:
        """
        只查状态和余额：
        1) 先调用综合查询接口（API-4）：可取 套餐/状态/余额/激活时间
        2) 若综合查询失败：
           - 再查余额查询接口（这里用 API-2 queryInfoBill 做兜底探测）
             - 若能查到：判定状态=已销户（余额字段尝试从 API-2 响应中探测，可能为 None）
             - 若查不到：判定状态=未开户
        """
        try:
            info = self._api.get_balance_menu1(phone=phone, cookie=cookie)
            return BalanceQueryResult(
                phone=phone,
                balance=info.balance,
                plan_name=info.plan_name,
                user_status=info.user_status,
                active_time=info.active_time,
                owe_amount=None,
                message="完成",
            )
        except Exception:
            try:
                qb = self._api.query_balances(phone=phone, cookie=cookie)
                return BalanceQueryResult(
                    phone=phone,
                    balance=qb.remain_amount,
                    plan_name=None,
                    user_status="已销户",
                    active_time=None,
                    owe_amount=qb.owe_amount,
                    message="综合查询失败，余额查询成功：判定已销户",
                )
            except Exception:
                return BalanceQueryResult(
                    phone=phone,
                    balance=None,
                    plan_name=None,
                    user_status="未开户",
                    active_time=None,
                    owe_amount=None,
                    message="综合查询失败，余额查询也失败：判定未开户",
                )

    def query_simple_phones(self, *, phones: list[str], cookie: str, bill_yyyymm_fallback: str | None = None) -> list[BalanceQueryResult]:
        return self.process_phones(phones=phones, cookie=cookie, bill_yyyymm_fallback=bill_yyyymm_fallback)

    def process_single_phone(self, *, phone: str, cookie: str, **kwargs) -> BalanceQueryResult:
        bill_yyyymm_fallback = kwargs.get("bill_yyyymm_fallback")
        return self.query_simple_single(phone=phone, cookie=cookie, bill_yyyymm_fallback=bill_yyyymm_fallback)

    def query_ledger_single(
        self,
        *,
        phone: str,
        cookie: str,
    ) -> tuple[BalanceQueryResult, list[BalanceLedgerRow]]:
        """
        查询状态和具体账本明细：
        1) 先综合查询接口（API-4）取状态/余额/套餐/激活时间
        2) 若综合查询失败：
           - 再查余额查询接口（API-11 queryBalances）
             - 若能查到：判定状态=已销户，继续获取账本明细
             - 若查不到：判定状态=未开户
        3) 综合查询成功后，仍需调用余额查询接口取账本明细
        """
        base: BalanceQueryResult
        try:
            info = self._api.get_balance_menu1(phone=phone, cookie=cookie)
            base = BalanceQueryResult(
                phone=phone,
                balance=info.balance,
                plan_name=info.plan_name,
                user_status=info.user_status,
                active_time=info.active_time,
                owe_amount=None,
                message="完成",
            )
        except Exception:
            try:
                qb = self._api.query_balances(phone=phone, cookie=cookie)
                base = BalanceQueryResult(
                    phone=phone,
                    balance=qb.remain_amount,
                    plan_name=None,
                    user_status="已销户",
                    active_time=None,
                    owe_amount=qb.owe_amount,
                    message="综合查询失败，余额查询成功：判定已销户",
                )
            except Exception:
                return (
                    BalanceQueryResult(
                        phone=phone,
                        balance=None,
                        plan_name=None,
                        user_status="未开户",
                        active_time=None,
                        owe_amount=None,
                        message="综合查询失败，余额查询也失败：判定未开户",
                    ),
                    [],
                )

        try:
            qb = self._api.query_balances(phone=phone, cookie=cookie)
            rows: list[BalanceLedgerRow] = []
            for r in qb.amount_rows:
                rows.append(
                    BalanceLedgerRow(
                        phone=phone,
                        plan_name=base.plan_name,
                        user_status=base.user_status,
                        active_time=base.active_time,
                        balance=base.balance,
                        owe_amount=qb.owe_amount,
                        item_type="金额账本",
                        item_name=r.amounttype,
                        amount=str(r.amount),
                        unit="元",
                        eff_date=None,
                        exp_date=None,
                        message="完成",
                    )
                )
            for r in qb.resource_rows:
                rows.append(
                    BalanceLedgerRow(
                        phone=phone,
                        plan_name=base.plan_name,
                        user_status=base.user_status,
                        active_time=base.active_time,
                        balance=base.balance,
                        owe_amount=qb.owe_amount,
                        item_type="资源账本",
                        item_name=r.balance_type_name,
                        amount=r.real_balance,
                        unit=r.resource_type,
                        eff_date=r.eff_date,
                        exp_date=r.exp_date,
                        message="完成",
                    )
                )
            if not rows:
                rows.append(
                    BalanceLedgerRow(
                        phone=phone,
                        plan_name=base.plan_name,
                        user_status=base.user_status,
                        active_time=base.active_time,
                        balance=base.balance,
                        owe_amount=qb.owe_amount,
                        item_type="",
                        item_name="",
                        amount="",
                        unit=None,
                        eff_date=None,
                        exp_date=None,
                        message="无账本明细",
                    )
                )
            return base, rows
        except Exception as e:
            return (
                BalanceQueryResult(
                    phone=phone,
                    balance=base.balance,
                    plan_name=base.plan_name,
                    user_status=base.user_status,
                    active_time=base.active_time,
                    owe_amount=None,
                    message=f"账本明细查询失败：{e}",
                ),
                [
                    BalanceLedgerRow(
                        phone=phone,
                        plan_name=base.plan_name,
                        user_status=base.user_status,
                        active_time=base.active_time,
                        balance=base.balance,
                        owe_amount=None,
                        item_type="",
                        item_name="",
                        amount="",
                        unit=None,
                        eff_date=None,
                        exp_date=None,
                        message=f"账本明细查询失败：{e}",
                    )
                ],
            )

    def query_ledger_phones(self, *, phones: list[str], cookie: str) -> list[BalanceLedgerRow]:
        out: list[BalanceLedgerRow] = []
        for p in phones:
            p2 = (p or "").strip()
            if not p2:
                continue
            _, rows = self.query_ledger_single(phone=p2, cookie=cookie)
            out.extend(rows)
        return out

