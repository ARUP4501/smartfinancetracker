from datetime import datetime, timezone

from app.models.collections import notifications


def create_notification(user_id, kind, title, message, severity="info"):
    doc = {
        "user_id": user_id,
        "type": kind,
        "title": title,
        "message": message,
        "severity": severity,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    }
    notifications().insert_one(doc)
    return doc
