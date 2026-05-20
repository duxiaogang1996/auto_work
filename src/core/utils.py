from __future__ import annotations

import re


def parse_phones(text: str) -> list[str]:
    """解析手机号文本，支持换行/逗号分隔，去重去空。"""
    raw = (text or "").replace("\r\n", "\n").replace(",", "\n")
    out: list[str] = []
    seen = set()
    for line in raw.split("\n"):
        p = line.strip()
        if not p:
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out


def normalize_cookie(raw: object) -> str:
    """规范化 Cookie 字符串，支持 curl、多行等格式。"""
    s = str(raw or "")
    s = s.replace("`", "").strip()
    if not s:
        return ""

    def _strip_quotes(x: str) -> str:
        x2 = x.strip()
        if (x2.startswith("'") and x2.endswith("'")) or (x2.startswith('"') and x2.endswith('"')):
            return x2[1:-1].strip()
        return x2

    s = _strip_quotes(s)

    if "curl" in s:
        m = re.search(r"-H\s+'Cookie:\s*([^']+)'", s, flags=re.IGNORECASE)
        if not m:
            m = re.search(r'-H\s+"Cookie:\s*([^"]+)"', s, flags=re.IGNORECASE)
        if not m:
            m = re.search(r"--header\s+'Cookie:\s*([^']+)'", s, flags=re.IGNORECASE)
        if not m:
            m = re.search(r'--header\s+"Cookie:\s*([^"]+)"', s, flags=re.IGNORECASE)
        if m:
            return _strip_quotes(m.group(1))

    if "\n" in s or "\r" in s:
        lines = [ln.strip() for ln in s.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        for ln in lines:
            if ln.lower().startswith("cookie:"):
                return _strip_quotes(ln.split(":", 1)[1])
        merged = " ".join([ln for ln in lines if ln])
        if merged.lower().startswith("cookie:"):
            merged = merged.split(":", 1)[1]
        return _strip_quotes(merged)

    if s.lower().startswith("cookie:"):
        return _strip_quotes(s.split(":", 1)[1])

    return _strip_quotes(s)
