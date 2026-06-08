from datetime import datetime, timezone

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.collections import transactions
from app.services.reports import build_report_rows, excel_file, pdf_file
from app.utils.responses import ok

reports_bp = Blueprint("reports", __name__)


def report_query(user_id):
    query = {"user_id": user_id}
    report_type = request.args.get("type")
    if report_type == "income":
        query["type"] = "income"
    elif report_type == "expense":
        query["type"] = "expense"
    
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    
    date_filter = {}
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$gte"] = start_date
        except ValueError:
            pass
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            date_filter["$lte"] = end_date
        except ValueError:
            pass
            
    if date_filter:
        query["date"] = date_filter
    return query


@reports_bp.get("/")
@jwt_required()
def report_preview():
    rows = build_report_rows(list(transactions().find(report_query(get_jwt_identity())).sort("date", -1)))
    return ok({"rows": rows})


@reports_bp.get("/export")
@jwt_required()
def export_report():
    rows = build_report_rows(list(transactions().find(report_query(get_jwt_identity())).sort("date", -1)))
    fmt = request.args.get("format", "pdf")
    if fmt == "excel":
        return send_file(excel_file(rows), download_name="financial-report.xlsx", as_attachment=True, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return send_file(pdf_file(rows, "Financial Report"), download_name="financial-report.pdf", as_attachment=True, mimetype="application/pdf")
