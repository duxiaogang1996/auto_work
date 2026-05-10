from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.suspend_service import SuspendService
from core.result_serializers import serialize_suspend_result
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

suspend_bp = Blueprint("suspend", __name__, url_prefix="/api/suspend")
suspend_service = SuspendService()


def _process(cookie: str, phones: list[str], auto_suspend: bool):
    results = suspend_service.process_phones(phones=phones, cookie=cookie, auto_suspend=auto_suspend)
    rows = [serialize_suspend_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@suspend_bp.post("/process")
def process_suspend():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_suspend = bool(payload.get("auto_suspend", True))
    return _process(cookie, phones, auto_suspend)


@suspend_bp.post("/process_one")
def process_suspend_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_suspend = bool(payload.get("auto_suspend", True))
    return _process(cookie, [phone], auto_suspend)


@suspend_bp.post("/export")
def export_suspend():
    import json
    from io import StringIO
    from flask import Response

    payload = request.get_json(silent=True)
    if payload is None:
        from flask import request as req
        data_json = req.form.get("data_json") or ""
        if data_json:
            payload = json.loads(data_json)
        else:
            payload = {}
    data = (payload.get("data") or []) if isinstance(payload, dict) else []

    phones_to_suspend = [item.get("phone") for item in data if item.get("should_suspend")]

    si = StringIO()
    import csv
    writer = csv.writer(si)
    writer.writerow(["手机号"])
    for phone in phones_to_suspend:
        if phone:
            writer.writerow([phone])

    output = "﻿" + si.getvalue()
    si.close()

    return Response(
        output.encode("utf-8"),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=停机.csv; filename*=UTF-8''%E5%81%9C%E6%9C%BA.csv"},
    )
