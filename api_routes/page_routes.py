from __future__ import annotations

import os
import sys

from flask import Blueprint, render_template, send_from_directory

from app_factory import get_resource_path

page_bp = Blueprint("page", __name__)


@page_bp.get("/")
def index():
    return render_template("index.html")


@page_bp.get("/docs/<path:filename>")
def serve_docs(filename):
    docs_dir = get_resource_path("docs")
    return send_from_directory(docs_dir, filename)
