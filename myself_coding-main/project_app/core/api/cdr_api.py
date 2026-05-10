from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from .bossweb_client import BossWebClient


@dataclass(frozen=True)
class CdrRow:
    start_time: str
    call_type: str
    called_number: str
    roma_type: str | None
    charge: Decimal | None
    raw: dict[str, Any]


@dataclass(frozen=True)
class CdrPage:
    rows: list[CdrRow]
    page_count: int | None
    total_record: int | None
    total_charge: Decimal | None
    raw: dict[str, Any]


def _to_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except Exception:
        return None


def _to_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except Exception:
        return None


def parse_api8_cdrs(payload: dict[str, Any]) -> CdrPage:
    if payload.get("type") != "success":
        raise RuntimeError(f"API-8 failed: {payload}")
    args = payload.get("args") or {}
    msg = args.get("message") or {}
    data_rows = msg.get("dataRows") or []
    rows: list[CdrRow] = []
    for r in data_rows:
        if not isinstance(r, dict):
            continue
        rows.append(
            CdrRow(
                start_time=str(r.get("startTime") or ""),
                call_type=str(r.get("callType") or ""),
                called_number=str(r.get("calledNumber") or ""),
                roma_type=None if r.get("romaType") is None else str(r.get("romaType")),
                charge=_to_decimal(r.get("charge")),
                raw=r,
            )
        )
    return CdrPage(
        rows=rows,
        page_count=_to_int(args.get("pageCount")),
        total_record=_to_int(args.get("TotalRecord")),
        total_charge=_to_decimal(args.get("TotalCharge")),
        raw=payload,
    )


class CdrApi:
    def __init__(self, client: BossWebClient | None = None) -> None:
        self._client = client or BossWebClient()

    def query_cdrs_page(
        self,
        *,
        msisdn: str,
        service_type: str,
        bill_cycle_id: str,
        start_time: str,
        end_time: str,
        page_index: int,
        row_per_page: int,
        query_call_type: str,
        query_number: str,
        cookie: str,
    ) -> CdrPage:
        payload = self._client.api8_query_subs_cdrs(
            msisdn=msisdn,
            service_type=service_type,
            bill_cycle_id=bill_cycle_id,
            start_time=start_time,
            end_time=end_time,
            page_index=page_index,
            row_per_page=row_per_page,
            query_call_type=query_call_type,
            query_number=query_number,
            cookie=cookie,
        )
        return parse_api8_cdrs(payload)

