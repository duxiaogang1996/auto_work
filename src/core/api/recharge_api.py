from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from .bossweb_client import BossWebClient, extract_gift_amount_from_comment


@dataclass(frozen=True)
class ReturnRecord:
    eff_date: str
    give_status: str
    no_give_reason: str | None
    release_fee: Decimal


@dataclass(frozen=True)
class BillSummary:
    bill_yyyymm: str
    total_deduct: Decimal
    raw: dict[str, Any]


@dataclass(frozen=True)
class BillLedgerRow:
    glname: str
    charge: Decimal
    raw: dict[str, Any]


@dataclass(frozen=True)
class BillLedger:
    bill_yyyymm: str
    balance: Decimal | None
    rows: list[BillLedgerRow]
    raw: dict[str, Any]


@dataclass(frozen=True)
class BalanceAmountRow:
    amounttype: str
    amount: Decimal
    raw: dict[str, Any]


@dataclass(frozen=True)
class BalanceResourceRow:
    balance_type_name: str
    real_balance: str
    resource_type: str | None
    eff_date: str | None
    exp_date: str | None
    raw: dict[str, Any]


@dataclass(frozen=True)
class QueryBalancesResult:
    remain_amount: Decimal | None
    freeze_amount: Decimal | None
    owe_amount: Decimal | None
    amount_rows: list[BalanceAmountRow]
    resource_rows: list[BalanceResourceRow]
    raw: dict[str, Any]


@dataclass(frozen=True)
class BalanceInfo:
    balance: Decimal
    plan_name: str | None
    user_status: str | None
    active_time: str | None


def _to_decimal(value: object) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value).strip() or "0")


def _to_decimal_optional(value: object) -> Decimal | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except Exception:
        return None


def _find_decimal_in_mapping(m: dict[str, Any], keys: list[str]) -> Decimal | None:
    for k in keys:
        if k in m:
            v = _to_decimal_optional(m.get(k))
            if v is not None:
                return v
    return None


def parse_api1_records(payload: dict[str, Any]) -> list[ReturnRecord]:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-1 failed: {payload}")
    items = (payload.get("args") or {}).get("list") or []
    out: list[ReturnRecord] = []
    for it in items:
        out.append(
            ReturnRecord(
                eff_date=str(it.get("effDate", "")),
                give_status=str(it.get("giveStatus", "")),
                no_give_reason=it.get("noGiveReason"),
                release_fee=_to_decimal(it.get("releaseFee", "0")),
            )
        )
    return out


def parse_api2_total_deduct(payload: dict[str, Any], bill_yyyymm: str) -> BillSummary:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-2 failed: {payload}")
    
    dto = ((payload.get("args") or {}).get("queryBillDto") or {})
    
    # 按照新需求，不再直接取 totalDeduct，而是遍历明细
    # 只有当 glname 是“会员服务费”时，才将对应的 charge 累加
    total_deduct = Decimal("0")
    
    acct_page = dto.get("acctItemDtoPage") or {}
    data_rows = acct_page.get("dataRows") or []
    
    for row in data_rows:
        glname = str(row.get("glname") or "").strip()
        if glname == "会员服务费":
            charge_val = _to_decimal(row.get("charge", "0"))
            total_deduct += charge_val

    return BillSummary(bill_yyyymm=bill_yyyymm, total_deduct=total_deduct, raw=payload)


def parse_api2_ledger(payload: dict[str, Any], bill_yyyymm: str) -> BillLedger:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-2 failed: {payload}")

    args = payload.get("args") or {}
    dto = (args.get("queryBillDto") or {}) if isinstance(args, dict) else {}

    acct_page = dto.get("acctItemDtoPage") or {}
    data_rows = acct_page.get("dataRows") or []
    rows: list[BillLedgerRow] = []
    for row in data_rows:
        if not isinstance(row, dict):
            continue
        glname = str(row.get("glname") or "").strip()
        charge = _to_decimal(row.get("charge", "0"))
        rows.append(BillLedgerRow(glname=glname, charge=charge, raw=row))

    # 余额字段在不同环境下可能有不同字段名，这里做尽量保守的探测
    balance = None
    if isinstance(dto, dict):
        balance = _find_decimal_in_mapping(
            dto,
            keys=[
                "acct_Balance",
                "acctBalance",
                "acct_balance",
                "balance",
                "acct_bal",
                "acctBal",
            ],
        )
    if balance is None and isinstance(args, dict):
        balance = _find_decimal_in_mapping(
            args,
            keys=[
                "acct_Balance",
                "acctBalance",
                "acct_balance",
                "balance",
            ],
        )

    return BillLedger(bill_yyyymm=bill_yyyymm, balance=balance, rows=rows, raw=payload)


def parse_api3_gifted_amount(payload: dict[str, Any]) -> tuple[Decimal, list[dict[str, Any]]]:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-3 failed: {payload}")
    rows = (((payload.get("args") or {}).get("orderDtoList") or {}).get("dataRows") or [])
    gifted = Decimal("0")
    kept_rows: list[dict[str, Any]] = []
    for r in rows:
        kept_rows.append(r)
        name = str(r.get("UserEventName") or r.get("userEventName") or "")
        status = str(r.get("OrderStatus") or r.get("orderStatus") or "")
        comment = r.get("Comments") or r.get("comments") or ""
        if status != "竣工":
            continue
        comment_s = str(comment)
        # 根据最新需求：只要满足状态为"竣工"，并且备注(或事件)中包含"后台赠送"就计入已赠费
        if "后台赠送" not in comment_s:
            continue
        gifted += extract_gift_amount_from_comment(comment_s)
    return gifted, kept_rows


def parse_api4_balance(payload: dict[str, Any]) -> BalanceInfo:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-4 failed: {payload}")
    info = (payload.get("args") or {}).get("info") or {}
    balance = _to_decimal(info.get("acct_Balance", "0"))
    plan_name = info.get("subs_Plan_Name")
    user_status = info.get("user_status")
    active_time = info.get("active_time")
    return BalanceInfo(balance=balance, plan_name=plan_name, user_status=user_status, active_time=active_time)


def parse_api5_success(payload: dict[str, Any]) -> bool:
    return payload.get("type") == "success" and payload.get("content") == "success"


def parse_api11_query_balances(payload: dict[str, Any]) -> QueryBalancesResult:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-11 failed: {payload}")
    args = payload.get("args") or {}
    if not isinstance(args, dict):
        args = {}

    remain_amount = _to_decimal_optional(args.get("remainAmount"))
    freeze_amount = _to_decimal_optional(args.get("freezeAmount"))
    owe_amount = _to_decimal_optional(args.get("oweAmount"))

    amount_rows: list[BalanceAmountRow] = []
    amount_list = args.get("amountDtoList") or {}
    if isinstance(amount_list, dict):
        rows = amount_list.get("dataRows") or []
        if isinstance(rows, list):
            for r in rows:
                if not isinstance(r, dict):
                    continue
                amount_rows.append(
                    BalanceAmountRow(
                        amounttype=str(r.get("amounttype") or "").strip(),
                        amount=_to_decimal(r.get("amount", "0")),
                        raw=r,
                    )
                )

    resource_rows: list[BalanceResourceRow] = []
    resource_list = args.get("remainResourceDtoList") or {}
    if isinstance(resource_list, dict):
        rows = resource_list.get("dataRows") or []
        if isinstance(rows, list):
            for r in rows:
                if not isinstance(r, dict):
                    continue
                resource_rows.append(
                    BalanceResourceRow(
                        balance_type_name=str(r.get("balance_type_name") or "").strip(),
                        real_balance=str(r.get("real_balance") or "").strip(),
                        resource_type=None if r.get("resourceType") is None else str(r.get("resourceType")),
                        eff_date=None if r.get("effDate") is None else str(r.get("effDate")),
                        exp_date=None if r.get("expDate") is None else str(r.get("expDate")),
                        raw=r,
                    )
                )

    return QueryBalancesResult(
        remain_amount=remain_amount,
        freeze_amount=freeze_amount,
        owe_amount=owe_amount,
        amount_rows=amount_rows,
        resource_rows=resource_rows,
        raw=payload,
    )


class RechargeApi:
    def __init__(self, client: BossWebClient | None = None) -> None:
        self._client = client or BossWebClient()

    def get_unreturned_month_records(self, *, phone: str, cookie: str) -> list[ReturnRecord]:
        payload = self._client.api1_qry_prom_detail(phone=phone, cookie=cookie)
        records = parse_api1_records(payload)
        return [r for r in records if r.give_status == "状态不符未返还"]

    def get_bill_total_deduct(self, *, phone: str, bill_yyyymm: str, cookie: str) -> BillSummary:
        payload = self._client.api2_query_info_bill(phone=phone, bill_yyyymm=bill_yyyymm, cookie=cookie)
        return parse_api2_total_deduct(payload, bill_yyyymm=bill_yyyymm)

    def get_bill_ledger(self, *, phone: str, bill_yyyymm: str, cookie: str) -> BillLedger:
        payload = self._client.api2_query_info_bill(phone=phone, bill_yyyymm=bill_yyyymm, cookie=cookie)
        return parse_api2_ledger(payload, bill_yyyymm=bill_yyyymm)

    def get_gifted_amount(self, *, phone: str, start_date: str, end_date: str, cookie: str) -> tuple[Decimal, list[dict[str, Any]]]:
        gifted_total = Decimal("0")
        kept_rows_all: list[dict[str, Any]] = []
        page_index = 1
        while True:
            payload = self._client.api3_query_subs_order_query(
                phone=phone,
                start_date=start_date,
                end_date=end_date,
                page_index=page_index,
                row_per_page=50,
                cookie=cookie,
            )
            gifted, kept_rows = parse_api3_gifted_amount(payload)
            gifted_total += gifted
            kept_rows_all.extend(kept_rows)

            args = payload.get("args") or {}
            order_list = (args.get("orderDtoList") or {})
            rows = (order_list.get("dataRows") or [])
            if not rows:
                break

            page_info = (order_list.get("pageInfo") or args.get("pageInfo") or {})
            total_pages = page_info.get("totalPages") or page_info.get("totalPage")
            try:
                if total_pages is not None and int(total_pages) <= page_index:
                    break
            except Exception:
                pass

            page_index += 1
            if page_index > 30:
                break

        return gifted_total, kept_rows_all

    def get_balance(self, *, phone: str, cookie: str) -> BalanceInfo:
        payload = self._client.api4_query_subs_base_info(phone=phone, cookie=cookie)
        return parse_api4_balance(payload)

    def get_balance_menu1(self, *, phone: str, cookie: str) -> BalanceInfo:
        payload = self._client.api4_query_subs_base_info_menu1(phone=phone, cookie=cookie)
        return parse_api4_balance(payload)

    def send_charge(self, *, phone: str, amount: Decimal, reason: str, cookie: str) -> bool:
        payload = self._client.api5_send_charge_submit(phone=phone, amount=amount, reason=reason, cookie=cookie)
        return parse_api5_success(payload)

    def query_balances(self, *, phone: str, cookie: str) -> QueryBalancesResult:
        payload = self._client.api11_query_balances(phone=phone, cookie=cookie)
        return parse_api11_query_balances(payload)
