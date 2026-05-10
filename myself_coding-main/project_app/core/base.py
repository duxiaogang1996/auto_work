from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any


class BatchPhoneService(ABC):
    """批量手机号处理服务基类。提供标准的逐号处理循环（含错误捕获）。"""

    @abstractmethod
    def process_single_phone(self, *, phone: str, cookie: str, **kwargs) -> Any:
        ...

    @abstractmethod
    def _error_result(self, *, phone: str, error: Exception) -> Any:
        ...

    def process_phones(self, *, phones: list[str], cookie: str, **kwargs) -> list[Any]:
        results: list[Any] = []
        for p in phones:
            p2 = (p or "").strip()
            if not p2:
                continue
            try:
                results.append(self.process_single_phone(phone=p2, cookie=cookie, **kwargs))
            except Exception as e:
                results.append(self._error_result(phone=p2, error=e))
        return results
