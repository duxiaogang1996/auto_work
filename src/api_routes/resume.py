from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.resume_service import ResumeService
from core.result_serializers import serialize_resume_result
from core.export_utils import export_csv, parse_data_json
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
    data = parse_data_json() or []
    phones = [item.get("phone") for item in data if item.get("can_resume")]
    return export_csv([p for p in phones if p], filename="开机.csv")
