from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.api.bossweb_client import BossWebClient


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


class OrderCancelService:
    def __init__(self, client: BossWebClient | None = None) -> None:
        self._client = client or BossWebClient()

    def process(self, *, cookie: str, phones: list[str], operation_type: str = "W") -> list[CancelOrderResult]:
        results: list[CancelOrderResult] = []
        for phone in phones:
            p2 = (phone or "").strip()
            if not p2:
                continue
            q = self._client.api6_user_message_query(phone=p2, operation_type=operation_type, cookie=cookie)
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
                c = self._client.api7_user_message_out(phone=p2, operation_type=operation_type, cookie=cookie)
                cancel_type = str(c.get("type") or "")
                cancel_content = str(c.get("content") or "")

            results.append(
                CancelOrderResult(
                    phone=p2,
                    query_type=q_type,
                    query_content=q_content,
                    can_cancel=can_cancel,
                    user_status=str(user_status) if user_status is not None else None,
                    order_status=str(order_status) if order_status is not None else None,
                    jd_order_id=str(jd_order_id) if jd_order_id is not None else None,
                    cancel_type=cancel_type,
                    cancel_content=cancel_content,
                )
            )
        return results

