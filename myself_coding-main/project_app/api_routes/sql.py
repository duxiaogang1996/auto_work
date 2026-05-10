from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.sql_generator import ProductSqlGenerator

sql_bp = Blueprint("sql", __name__, url_prefix="/api/sql")


@sql_bp.post("/generate_product")
def generate_product_sql():
    payload = request.get_json(force=True, silent=True) or {}
    generator = ProductSqlGenerator(payload)
    sql_text = generator.generate()
    return jsonify({"success": True, "sql": sql_text})
