from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.collections import notifications
from app.utils.responses import ok

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/")
@jwt_required()
def list_notifications():
    items = list(notifications().find({"user_id": get_jwt_identity()}).sort("created_at", -1).limit(25))
    unread = notifications().count_documents({"user_id": get_jwt_identity(), "is_read": False})
    return ok({"items": items, "unread": unread})


@notifications_bp.put("/<notification_id>/read")
@jwt_required()
def mark_read(notification_id):
    notifications().update_one({"_id": notification_id, "user_id": get_jwt_identity()}, {"$set": {"is_read": True}})
    return ok({}, "Notification read.")
