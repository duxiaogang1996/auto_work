from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.services.sql_generator import ProductSqlGenerator
from core.services.package_sql_generator import PackageSqlGenerator
from core.services.offer_sql_generator import OfferSqlGenerator

sql_bp = Blueprint("sql", __name__, url_prefix="/api/sql")


@sql_bp.post("/generate_product")
def generate_product_sql():
    payload = request.get_json(force=True, silent=True) or {}
    generator = ProductSqlGenerator(payload)
    sql_text = generator.generate()
    return jsonify({"success": True, "sql": sql_text})


@sql_bp.post("/generate_package")
def generate_package_sql():
    payload = request.get_json(force=True, silent=True) or {}
    generator = PackageSqlGenerator(payload)
    sql_text = generator.generate()
    return jsonify({"success": True, "sql": sql_text})


@sql_bp.post("/generate_offer")
def generate_offer_sql():
    payload = request.get_json(force=True, silent=True) or {}
    generator = OfferSqlGenerator(payload)
    sql_text = generator.generate()
    return jsonify({"success": True, "sql": sql_text})
