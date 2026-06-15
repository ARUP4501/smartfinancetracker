from datetime import datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.collections import budgets
from app.services.finance import build_budget_usage, month_key
from app.utils.responses import fail, ok

budgets_bp = Blueprint("budgets", __name__)


@budgets_bp.get("/")
@jwt_required()
def list_budgets():
    return ok({"items": build_budget_usage(get_jwt_identity())})


@budgets_bp.post("/")
@jwt_required()
def create_budget():
    payload = request.get_json() or {}
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        return fail("Budget amount must be greater than zero.", 422)
    
    user_id = get_jwt_identity()
    category = payload.get("category") or "Overall"
    month = payload.get("month") or month_key()

    # Check if a budget with the same category and month already exists for this user
    existing = budgets().find_one({
        "user_id": user_id,
        "category": category,
        "month": month
    })
    if existing:
        return fail(f"A budget for '{category}' already exists for this month ({month}). You can edit the existing budget.", 400)

    doc = {
        "user_id": user_id,
        "category": category,
        "amount": amount,
        "period": payload.get("period") or "monthly",
        "month": month,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    budgets().insert_one(doc)
    return ok(doc, "Budget created.", 201)


@budgets_bp.put("/<budget_id>")
@jwt_required()
def update_budget(budget_id):
    payload = request.get_json() or {}
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        return fail("Budget amount must be greater than zero.", 422)
    
    category = payload.get("category") or "Overall"
    month = payload.get("month") or month_key()
    user_id = get_jwt_identity()

    # Check if another budget with the same category and month already exists
    existing = budgets().find_one({
        "_id": {"$ne": budget_id},
        "user_id": user_id,
        "category": category,
        "month": month
    })
    if existing:
        return fail(f"A budget for '{category}' already exists for this month ({month}). You can edit the existing budget.", 400)

    budgets().update_one(
        {"_id": budget_id, "user_id": user_id},
        {"$set": {
            "category": category,
            "amount": amount,
            "period": payload.get("period") or "monthly",
            "month": month,
            "updated_at": datetime.now(timezone.utc)
        }},
    )
    return ok({}, "Budget updated.")


@budgets_bp.delete("/<budget_id>")
@jwt_required()
def delete_budget(budget_id):
    budgets().delete_one({"_id": budget_id, "user_id": get_jwt_identity()})
    return ok({}, "Budget deleted.")
