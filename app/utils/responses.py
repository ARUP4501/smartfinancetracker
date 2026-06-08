from datetime import date, datetime
from decimal import Decimal

from flask import jsonify


def serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


def ok(data=None, message="OK", status=200):
    return jsonify({"success": True, "message": message, "data": serialize(data or {})}), status


def fail(message="Request failed", status=400, errors=None):
    payload = {"success": False, "message": message}
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status
