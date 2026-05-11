"""停机/开机原因码配置。可按需改为从数据库或配置文件读取。"""

from __future__ import annotations


class SuspendReasonCodes:
    """停机原因码映射。"""
    TELECOM = "80"    # 电信
    UNICOM = "90"     # 联通
    DEFAULT = "90"    # 默认

    @classmethod
    def infer(cls, plan_name: str | None) -> str:
        if plan_name and "电信" in plan_name:
            return cls.TELECOM
        if plan_name and "联通" in plan_name:
            return cls.UNICOM
        return cls.DEFAULT


class ResumeReasonCodes:
    """开机原因码映射。"""
    TELECOM = "81"    # 电信
    UNICOM = "91"     # 联通
    DEFAULT = "91"    # 默认

    @classmethod
    def infer(cls, plan_name: str | None) -> str:
        if plan_name and "电信" in plan_name:
            return cls.TELECOM
        if plan_name and "联通" in plan_name:
            return cls.UNICOM
        return cls.DEFAULT
