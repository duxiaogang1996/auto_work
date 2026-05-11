from __future__ import annotations

from flask import Blueprint, request, jsonify

from core.database import (
    DatabaseConfig,
    DatabaseConnection,
    get_global_connection,
    set_global_connection,
)

db_bp = Blueprint("database", __name__, url_prefix="/api/database")


@db_bp.post("/connect")
def db_connect():
    payload = request.get_json(force=True, silent=True) or {}
    config = DatabaseConfig(
        host=payload.get("host", "localhost"),
        port=int(payload.get("port", 3306)),
        user=payload.get("user", "root"),
        password=payload.get("password", ""),
        database=payload.get("database", ""),
    )
    conn = DatabaseConnection(config)
    try:
        conn.connect()
        set_global_connection(conn)
        return jsonify({"success": True, "message": "连接成功"})
    except Exception as e:
        return jsonify({"success": False, "message": f"连接失败: {e}"})


@db_bp.post("/disconnect")
def db_disconnect():
    conn = get_global_connection()
    if conn:
        conn.disconnect()
        set_global_connection(None)
    return jsonify({"success": True, "message": "已断开连接"})


@db_bp.post("/check_status")
def db_check_status():
    conn = get_global_connection()
    if conn and conn.is_connected():
        return jsonify({"success": True, "message": "已连接", "connected": True})
    return jsonify({"success": False, "message": "未连接", "connected": False})


@db_bp.post("/execute")
def db_execute():
    conn = get_global_connection()
    if not conn or not conn.is_connected():
        return jsonify({"success": False, "message": "数据库未连接"})

    payload = request.get_json(force=True, silent=True) or {}
    sql_text = payload.get("sql", "").strip()
    if not sql_text:
        return jsonify({"success": False, "message": "SQL 不能为空"})

    statements = conn.split_sql_statements(sql_text)
    if not statements:
        return jsonify({"success": False, "message": "未解析到有效 SQL"})

    results = []
    for sql in statements:
        try:
            result = conn.execute_sql(sql)
            results.append(result)
        except Exception as e:
            results.append({
                "success": False,
                "message": str(e),
                "affected_rows": 0,
                "results": None,
            })

    all_success = all(r.get("success") for r in results)
    return jsonify({
        "success": all_success,
        "message": f"共执行 {len(results)} 条 SQL",
        "results": results,
    })
