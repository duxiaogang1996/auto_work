from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from core.api.bossweb_client import BossWebClient
from core.base import BatchPhoneService


@dataclass(frozen=True)
class CancelOrderResult:
    phone: str
    query_type: str
    query_content: str
    can_cancel: bool
    user_status: str | None
    order_status: str | None
    jd_order_id: str | None
    cancel_type: str | None
    cancel_content: str | None


class OrderCancelService(BatchPhoneService):
    def __init__(self, client: BossWebClient | None = None) -> None:
        super().__init__(batch_delay=0)
        self._client = client or BossWebClient()

    def process_single_phone(self, *, phone: str, cookie: str, **kwargs) -> CancelOrderResult:
        operation_type = kwargs.get("operation_type", "W")
        q = self._client.api6_user_message_query(phone=phone, operation_type=operation_type, cookie=cookie)
        q_type = str(q.get("type") or "")
        q_content = str(q.get("content") or "")

        puk: dict[str, Any] = {}
        args = q.get("args") or {}
        if isinstance(args, dict):
            puk_obj = args.get("pukQueryPo")
            if isinstance(puk_obj, dict):
                puk = puk_obj

        user_status = puk.get("user_status")
        order_status = puk.get("order_status")
        jd_order_id = puk.get("jd_order_id")

        can_cancel = q_type == "success"
        cancel_type = None
        cancel_content = None
        if can_cancel:
            c = self._client.api7_user_message_out(phone=phone, operation_type=operation_type, cookie=cookie)
            cancel_type = str(c.get("type") or "")
            cancel_content = str(c.get("content") or "")

        return CancelOrderResult(
            phone=phone,
            query_type=q_type,
            query_content=q_content,
            can_cancel=can_cancel,
            user_status=str(user_status) if user_status is not None else None,
            order_status=str(order_status) if order_status is not None else None,
            jd_order_id=str(jd_order_id) if jd_order_id is not None else None,
            cancel_type=cancel_type,
            cancel_content=cancel_content,
        )

    def _error_result(self, *, phone: str, error: Exception) -> CancelOrderResult:
        return CancelOrderResult(
            phone=phone,
            query_type="error",
            query_content=str(error),
            can_cancel=False,
            user_status=None,
            order_status=None,
            jd_order_id=None,
            cancel_type=None,
            cancel_content=None,
        )
