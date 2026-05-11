from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.cdr_service import CdrService
from core.result_serializers import serialize_cdr_result
from ._helpers import parse_cookie_and_phone

cdr_bp = Blueprint("cdr", __name__, url_prefix="/api/cdr")
cdr_service = CdrService()


@cdr_bp.post("/query")
def query_cdr():
    payload = request.get_json(force=True, silent=True) or {}
    cookie, phone, err = parse_cookie_and_phone(payload)
    if err:
        return jsonify(err[0]), err[1]
    service_type = str(payload.get("service_type") or "").strip()
    start_time = str(payload.get("start_time") or "").strip()
    end_time = str(payload.get("end_time") or "").strip()
    result_mode = str(payload.get("result_mode") or "detail").strip().lower()

    try:
        if result_mode == "total":
            result = cdr_service.query_total(
                msisdn=phone,
                service_type=service_type,
                start_time=start_time,
                end_time=end_time,
                cookie=cookie,
            )
            return jsonify(
                {
                    "success": True,
                    "data": [],
                    "page_count": result.page_count,
                    "total_record": result.total_record,
                    "total_charge": str(result.total_charge) if result.total_charge is not None else None,
                }
            )
        else:
            result = cdr_service.query_all(
                msisdn=phone,
                service_type=service_type,
                start_time=start_time,
                end_time=end_time,
                cookie=cookie,
            )
            rows = [serialize_cdr_result(r, phone) for r in result.rows]
            return jsonify(
                {
                    "success": True,
                    "data": rows,
                    "page_count": result.page_count,
                    "total_record": result.total_record,
                    "total_charge": str(result.total_charge) if result.total_charge is not None else None,
                }
            )
    except Exception as e:
        return jsonify({"success": False, "message": f"查询失败：{e}"}), 500
