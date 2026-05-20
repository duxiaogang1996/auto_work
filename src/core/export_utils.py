from __future__ import annotations

import csv
import io
import json
from typing import Any

from flask import Response, request

try:
    import xlwt
except ImportError:
    xlwt = None  # type: ignore


def export_csv(rows: list[str], field_name: str = "手机号", filename: str = "export.csv") -> Response:
    """将手机号列表导出为 UTF-8 BOM CSV 文件。"""
    si = io.StringIO()
    si.write("﻿")
    writer = csv.writer(si)
    writer.writerow([field_name])
    for phone in rows:
        writer.writerow([phone])
    output = si.getvalue().encode("utf-8")
    return Response(
        output,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def export_xls(rows: list[str], filename: str = "export.xls") -> Response:
    """将手机号列表导出为 XLS 文件。"""
    if xlwt is None:
        return Response("xlwt 不可用，无法导出 XLS", status=500)
    wb = xlwt.Workbook(encoding="utf-8")
    ws = wb.add_sheet("Sheet1")
    for i, phone in enumerate(rows):
        ws.write(i, 0, phone)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype="application/vnd.ms-excel",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def parse_data_json() -> list[dict[str, Any]] | None:
    """从请求体中解析 data JSON（支持 JSON body 或 form.data_json）。"""
    payload = request.get_json(force=True, silent=True)
    if payload and isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            return data
    data_json = request.form.get("data_json")
    if data_json:
        try:
            parsed = json.loads(data_json)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
    return None
