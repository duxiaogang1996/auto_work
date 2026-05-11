from __future__ import annotations

import threading

import pymysql
from pymysql.cursors import DictCursor
from typing import Any


class DatabaseConfig:
    def __init__(
        self,
        host: str = "localhost",
        port: int = 3306,
        user: str = "root",
        password: str = "",
        database: str = "",
    ):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database


class DatabaseConnection:
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.connection = None

    def connect(self) -> bool:
        try:
            self.connection = pymysql.connect(
                host=self.config.host,
                port=self.config.port,
                user=self.config.user,
                password=self.config.password,
                database=self.config.database if self.config.database else None,
                charset='utf8mb4',
                cursorclass=DictCursor
            )
            return True
        except Exception as e:
            self.connection = None
            raise e

    def disconnect(self) -> None:
        if self.connection:
            self.connection.close()
            self.connection = None

    def is_connected(self) -> bool:
        return self.connection is not None and self.connection.open

    def execute_sql(self, sql: str) -> dict[str, Any]:
        if not self.is_connected():
            raise Exception("数据库未连接，请先建立连接")

        sql = sql.strip()
        if not sql:
            return {"success": True, "message": "空SQL", "affected_rows": 0, "results": None}

        try:
            with self.connection.cursor() as cursor:
                affected_rows = cursor.execute(sql)

                if sql.strip().upper().startswith(('SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN')):
                    results = cursor.fetchall()
                    self.connection.commit()
                    return {
                        "success": True,
                        "message": f"查询成功，返回 {len(results)} 条记录",
                        "affected_rows": affected_rows,
                        "results": results
                    }
                else:
                    self.connection.commit()
                    return {
                        "success": True,
                        "message": f"执行成功，影响 {affected_rows} 行",
                        "affected_rows": affected_rows,
                        "results": None
                    }
        except Exception as e:
            self.connection.rollback()
            raise e

    def execute_multiple(self, sql_list: list[str]) -> list[dict[str, Any]]:
        results = []
        for sql in sql_list:
            try:
                result = self.execute_sql(sql)
                results.append(result)
            except Exception as e:
                results.append({
                    "success": False,
                    "message": str(e),
                    "affected_rows": 0,
                    "results": None
                })
        return results

    def split_sql_statements(self, sql_text: str) -> list[str]:
        sql_text = sql_text.strip()
        if not sql_text:
            return []

        statements = []
        current = []
        in_string = False
        string_char = None
        lines = sql_text.splitlines()

        for line in lines:
            line = line.strip()
            if not line or line.startswith('--') or line.startswith('#'):
                continue

            for i, char in enumerate(line):
                if char in ('"', "'") and (i == 0 or line[i-1] != '\\'):
                    if in_string and string_char == char:
                        in_string = False
                    elif not in_string:
                        in_string = True
                        string_char = char
                elif char == ';' and not in_string:
                    current.append(line[:i+1])
                    stmt = ''.join(current).strip()
                    if stmt:
                        statements.append(stmt)
                    current = []
                    continue
                current.append(char)
            if current:
                current.append(' ')

        if current:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)

        return statements


_db_local = threading.local()


def get_global_connection() -> DatabaseConnection | None:
    return getattr(_db_local, "connection", None)


def set_global_connection(conn: DatabaseConnection | None) -> None:
    _db_local.connection = conn
