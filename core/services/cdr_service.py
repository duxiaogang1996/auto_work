from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ..api.cdr_api import CdrApi, CdrRow


@dataclass(frozen=True)
class CdrQueryResult:
    rows: list[CdrRow]
    page_count: int | None
    total_record: int | None
    total_charge: str | None


def _yyyymm_from_date_str(d: str) -> str:
    s = (d or "").strip()
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.strftime("%Y%m")
    except Exception:
        return datetime.today().strftime("%Y%m")


class CdrService:
    def __init__(self, api: CdrApi | None = None) -> None:
        self._api = api or CdrApi()

    def query_total(
        self,
        *,
        msisdn: str,
        service_type: str,
        start_time: str,
        end_time: str,
        cookie: str,
    ) -> CdrQueryResult:
        bill_cycle_id = _yyyymm_from_date_str(start_time)
        page_data = self._api.query_cdrs_page(
            msisdn=msisdn,
            service_type=service_type,
            bill_cycle_id=bill_cycle_id,
            start_time=start_time,
            end_time=end_time,
            page_index=1,
            row_per_page=1,
            query_call_type="",
            query_number="",
            cookie=cookie,
        )
        return CdrQueryResult(
            rows=[],
            page_count=page_data.page_count,
            total_record=page_data.total_record,
            total_charge=None if page_data.total_charge is None else str(page_data.total_charge),
        )

    def query_all(
        self,
        *,
        msisdn: str,
        service_type: str,
        start_time: str,
        end_time: str,
        cookie: str,
        row_per_page: int = 200,
        max_pages: int = 30,
    ) -> CdrQueryResult:
        bill_cycle_id = _yyyymm_from_date_str(start_time)
        all_rows: list[CdrRow] = []
        page_count: int | None = None
        total_record: int | None = None
        total_charge: str | None = None

        for page in range(1, max_pages + 1):
            page_data = self._api.query_cdrs_page(
                msisdn=msisdn,
                service_type=service_type,
                bill_cycle_id=bill_cycle_id,
                start_time=start_time,
                end_time=end_time,
                page_index=page,
                row_per_page=row_per_page,
                query_call_type="",
                query_number="",
                cookie=cookie,
            )
            if page_count is None:
                page_count = page_data.page_count
            if total_record is None:
                total_record = page_data.total_record
            if total_charge is None:
                total_charge = None if page_data.total_charge is None else str(page_data.total_charge)

            if not page_data.rows:
                break
            all_rows.extend(page_data.rows)

            if page_count is not None and page >= page_count:
                break
            if total_record is not None and len(all_rows) >= total_record:
                break

        return CdrQueryResult(
            rows=all_rows,
            page_count=page_count,
            total_record=total_record,
            total_charge=total_charge,
        )
