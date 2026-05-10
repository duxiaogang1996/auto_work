from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.resume_service import ResumeService
from core.result_serializers import serialize_resume_result
from ._helpers import parse_cookie_and_phones, parse_cookie_and_phone

resume_bp = Blueprint("resume", __name__, url_prefix="/api/resume")
resume_service = ResumeService()


def _process(cookie: str, phones: list[str], auto_resume: bool, remark: str):
    results = resume_service.process_phones(phones=phones, cookie=cookie, auto_resume=auto_resume, remark=remark)
    rows = [serialize_resume_result(r) for r in results]
    return jsonify({"success": True, "data": rows})


@resume_bp.post("/process")
def process_resume():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phones, err = parse_cookie_and_phones(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_resume = bool(payload.get("auto_resume", True))
    remark = str(payload.get("remark") or "").strip()
    return _process(cookie, phones, auto_resume, remark)


@resume_bp.post("/process_one")
def process_resume_one():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    auto_resume = bool(payload.get("auto_resume", True))
    remark = str(payload.get("remark") or "").strip()
    return _process(cookie, [phone], auto_resume, remark)


@resume_bp.post("/export")
def export_resume():
    import json
    from io import StringIO
    from flask import Response
    import csv

    payload = request.get_json(silent=True)
    if payload is None:
        from flask import request as req
        data_json = req.form.get("data_json") or ""
        if data_json:
            payload = json.loads(data_json)
        else:
            payload = {}
    data = (payload.get("data") or []) if isinstance(payload, dict) else []

    phones_to_resume = [item.get("phone") for item in data if item.get("can_resume")]

    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(["手机号"])
    for phone in phones_to_resume:
        if phone:
            writer.writerow([phone])

    output = "﻿" + si.getvalue()
    si.close()

    return Response(
        output.encode("utf-8"),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=开机.csv; filename*=UTF-8''%E5%BC%80%E6%9C%BA.csv"},
    )
