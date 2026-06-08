from datetime import datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.collections import goals
from app.services.notifications import create_notification
from app.utils.responses import fail, ok

goals_bp = Blueprint("goals", __name__)


def goal_payload(doc):
    target = doc.get("target_amount", 1) or 1
    doc["completion"] = round((doc.get("current_amount", 0) / target) * 100, 2)
    return doc


@goals_bp.get("/")
@jwt_required()
def list_goals():
    return ok({"items": [goal_payload(item) for item in goals().find({"user_id": get_jwt_identity()}).sort("created_at", -1)]})


@goals_bp.post("/")
@jwt_required()
def create_goal():
    payload = request.get_json() or {}
    target = float(payload.get("target_amount", 0))
    current = float(payload.get("current_amount", 0))
    if target <= 0:
        return fail("Target amount must be greater than zero.", 422)
    doc = {
        "user_id": get_jwt_identity(),
        "name": payload.get("name") or "Savings Goal",
        "target_amount": target,
        "current_amount": current,
        "target_date": payload.get("target_date") or None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    goals().insert_one(doc)
    if current >= target:
        create_notification(get_jwt_identity(), "goal_achieved", "Goal achieved", f"{doc['name']} is fully funded.", "success")
    return ok(goal_payload(doc), "Goal created.", 201)


@goals_bp.put("/<goal_id>")
@jwt_required()
def update_goal(goal_id):
    payload = request.get_json() or {}
    current = float(payload.get("current_amount", 0))
    target = float(payload.get("target_amount", 0))
    goals().update_one(
        {"_id": goal_id, "user_id": get_jwt_identity()},
        {"$set": {"name": payload.get("name") or "Savings Goal", "target_amount": target, "current_amount": current, "target_date": payload.get("target_date") or None, "updated_at": datetime.now(timezone.utc)}},
    )
    if target and current >= target:
        create_notification(get_jwt_identity(), "goal_achieved", "Goal achieved", f"{payload.get('name', 'Savings Goal')} is fully funded.", "success")
    return ok({}, "Goal updated.")


@goals_bp.delete("/<goal_id>")
@jwt_required()
def delete_goal(goal_id):
    goals().delete_one({"_id": goal_id, "user_id": get_jwt_identity()})
    return ok({}, "Goal deleted.")
