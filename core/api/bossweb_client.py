from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
from typing import Any

import requests


_MONEY_RE = re.compile(r"(\d+(?:\.\d+)?)\s*元")

def _to_decimal_money(value: object) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    s = str(value).strip()
    if not s:
        return Decimal("0")
    return Decimal(s)

def _decimal_to_send_str(amount: Decimal) -> str:
    s = format(amount, "f")
    if "." not in s:
        return s
    s = s.rstrip("0").rstrip(".")
    return s or "0"


@dataclass(frozen=True)
class BossWebConfig:
    base_url: str = "http://bossweb.jd.com"


class BossWebClient:
    def __init__(self, config: BossWebConfig | None = None) -> None:
        self._config = config or BossWebConfig()
        self._session = requests.Session()

    def _headers(self, cookie: str, referer: str | None = None, origin: str | None = None) -> dict[str, str]:
        headers: dict[str, str] = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
            "Host": "bossweb.jd.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": cookie,
        }
        if referer:
            headers["Referer"] = referer
        if origin:
            headers["Origin"] = origin
        return headers

    def _get_json(self, path: str, *, params: dict[str, str], cookie: str, referer: str | None = None) -> dict[str, Any]:
        url = f"{self._config.base_url}{path}"
        resp = self._session.get(url, params=params, headers=self._headers(cookie, referer=referer), timeout=30)
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError as e:
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type or "doctype" in resp.text[:100]:
                raise RuntimeError(f"API返回了HTML而非JSON，通常是因为Cookie失效或需要重新登录。请求: {url}") from e
            raise RuntimeError(f"JSON解析失败：{e}，响应内容: {resp.text[:200]}...") from e

    def _post_form_json(
        self,
        path: str,
        *,
        form: dict[str, str],
        cookie: str,
        referer: str | None = None,
        origin: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self._config.base_url}{path}"
        headers = self._headers(cookie, referer=referer, origin=origin)
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
        resp = self._session.post(url, data=form, headers=headers, timeout=30)
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError as e:
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type or "doctype" in resp.text[:100]:
                raise RuntimeError(f"API返回了HTML而非JSON，通常是因为Cookie失效或需要重新登录。请求: {url}") from e
            raise RuntimeError(f"JSON解析失败：{e}，响应内容: {resp.text[:200]}...") from e

    def api1_qry_prom_detail(self, *, phone: str, cookie: str) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/QryPromDetail_Qry",
            params={"device_number": phone, "tele_type": "GSM"},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/QryPromDetail?menu_id=156",
        )

    def api2_query_info_bill(self, *, phone: str, bill_yyyymm: str, cookie: str) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/queryInfoBill",
            params={"device_number": phone, "date_bill": bill_yyyymm, "tele_type": "GSM"},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/queryBill?menu_id=5",
        )

    def api11_query_balances(self, *, phone: str, cookie: str, tele_type: str = "GSM") -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/queryBalances",
            params={"device_number": phone, "tele_type": tele_type},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/queryBalance?menu_id=7",
        )

    def api3_query_subs_order_query(
        self,
        *,
        phone: str,
        start_date: str,
        end_date: str,
        page_index: int = 1,
        row_per_page: int = 50,
        cookie: str,
        contact_channel: str = "123",
    ) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/querysubsorderquery",
            params={
                "MSISDN": phone,
                "teleType": "GSM",
                "startDate": start_date,
                "endDate": end_date,
                "pageIndex": str(page_index),
                "rowPerPage": str(row_per_page),
                "contactChannel": contact_channel,
            },
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/querySubsOrder?menu_id=4",
        )

    def api4_query_subs_base_info(self, *, phone: str, cookie: str) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/querySubsBaseInfo",
            params={"misidn": phone, "menuId": "156", "tele_type": "GSM"},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/QryPromDetail?menu_id=156",
        )

    def api4_query_subs_base_info_menu1(self, *, phone: str, cookie: str) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/querySubsBaseInfo",
            params={"misidn": phone, "menuId": "1", "tele_type": "GSM"},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/queryBase?menu_id=1",
        )

    def api5_send_charge_submit(self, *, phone: str, amount: Decimal, reason: str, cookie: str) -> dict[str, Any]:
        return self._post_form_json(
            "/busi_web/busi/sendChargeSubmit",
            form={"device_number": phone, "send_charge": _decimal_to_send_str(amount), "reason": reason},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web//busi/sendChargeView?menu_id=64",
            origin="http://bossweb.jd.com",
        )

    def api6_deal_open_close(
        self,
        *,
        phone: str,
        reason_code: str,
        tele_type: str,
        remark: str = "",
        cookie: str,
    ) -> dict[str, Any]:
        return self._post_form_json(
            "/busi_web/busi/dealOpenClose",
            form={"misidn": phone, "reasonCode": reason_code, "tele_type": tele_type, "remark": remark},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/openCloseJf?para=20&?menu_id=77",
            origin="http://bossweb.jd.com",
        )

    def api6_user_message_query(self, *, phone: str, operation_type: str = "W", cookie: str) -> dict[str, Any]:
        return self._post_form_json(
            "/busi_web/busi/userMessageQuery",
            form={"device_number": phone, "operation_Type": operation_type},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/orderCancel?menu_id=060",
            origin="http://bossweb.jd.com",
        )

    def api8_query_subs_cdrs(
        self,
        *,
        msisdn: str,
        service_type: str,
        bill_cycle_id: str,
        start_time: str,
        end_time: str,
        page_index: int = 1,
        row_per_page: int = 50,
        query_call_type: str = "",
        query_number: str = "",
        cookie: str,
    ) -> dict[str, Any]:
        return self._get_json(
            "/busi_web/busi/querySubsCDRs",
            params={
                "MSISDN": msisdn,
                "ServiceType": service_type,
                "BillCycleID": bill_cycle_id,
                "StartTime": start_time,
                "EndTime": end_time,
                "ContactChannle": "119",
                "PageIndex": str(page_index),
                "RowPerPage": str(row_per_page),
                "QueryCallType": query_call_type,
                "QueryNumber": query_number,
                "tele_type": "GSM",
                "chargeFlag": "0",
                "tuoMinFlag": "1",
            },
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/querySubsCDR?menu_id=6",
        )

    def api7_user_message_out(self, *, phone: str, operation_type: str = "W", cookie: str) -> dict[str, Any]:
        return self._post_form_json(
            "/busi_web/busi/userMessageOut",
            form={"device_number": phone, "operation_Type": operation_type},
            cookie=cookie,
            referer="http://bossweb.jd.com/busi_web/busi/orderCancel?menu_id=060",
            origin="http://bossweb.jd.com",
        )


def extract_gift_amount_from_comment(comment: object) -> Decimal:
    if comment is None:
        return Decimal("0")
    s = str(comment)
    m = _MONEY_RE.search(s)
    if not m:
        return Decimal("0")
    return _to_decimal_money(m.group(1))
