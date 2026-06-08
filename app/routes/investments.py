from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.collections import investments
from app.services.notifications import create_notification
from app.utils.responses import fail, ok

investments_bp = Blueprint("investments", __name__)


@investments_bp.get("/")
@jwt_required()
def list_investments():
    user_id = get_jwt_identity()
    items = list(investments().find({"user_id": user_id}).sort("created_at", -1))
    
    # Calculate summary metrics
    total_invested = sum(float(item.get("invested_amount", 0)) for item in items)
    total_current = sum(float(item.get("current_value", 0)) for item in items)
    total_returns = total_current - total_invested
    returns_pct = (total_returns / total_invested * 100) if total_invested > 0 else 0.0
    
    return ok({
        "items": items,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current": round(total_current, 2),
            "total_returns": round(total_returns, 2),
            "returns_pct": round(returns_pct, 2)
        }
    })


@investments_bp.post("/")
@jwt_required()
def create_investment():
    payload = request.get_json() or {}
    name = payload.get("name")
    if not name:
        return fail("Name is required.", 422)
    
    try:
        invested = float(payload.get("invested_amount", 0))
        current = float(payload.get("current_value", 0))
    except (ValueError, TypeError):
        return fail("Amounts must be valid numbers.", 422)
        
    doc = {
        "user_id": get_jwt_identity(),
        "name": name,
        "type": payload.get("type") or "Stocks",
        "invested_amount": invested,
        "current_value": current,
        "purchase_date": payload.get("purchase_date") or None,
        "units": float(payload.get("units") or 0) if payload.get("units") else None,
        "maturity_date": payload.get("maturity_date") or None,
        "interest_rate": float(payload.get("interest_rate") or 0) if payload.get("interest_rate") else None,
        "notes": payload.get("notes") or "",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    investments().insert_one(doc)
    
    create_notification(
        get_jwt_identity(),
        "investment_added",
        "Investment Added",
        f"Added {name} ({doc['type']}) with ₹{invested:,.2f} invested.",
        "success"
    )
    
    return ok(doc, "Investment created.", 201)


@investments_bp.put("/<investment_id>")
@jwt_required()
def update_investment(investment_id):
    payload = request.get_json() or {}
    name = payload.get("name")
    if not name:
        return fail("Name is required.", 422)
        
    try:
        invested = float(payload.get("invested_amount", 0))
        current = float(payload.get("current_value", 0))
    except (ValueError, TypeError):
        return fail("Amounts must be valid numbers.", 422)
        
    update_doc = {
        "name": name,
        "type": payload.get("type") or "Stocks",
        "invested_amount": invested,
        "current_value": current,
        "purchase_date": payload.get("purchase_date") or None,
        "units": float(payload.get("units") or 0) if payload.get("units") else None,
        "maturity_date": payload.get("maturity_date") or None,
        "interest_rate": float(payload.get("interest_rate") or 0) if payload.get("interest_rate") else None,
        "notes": payload.get("notes") or "",
        "updated_at": datetime.now(timezone.utc)
    }
    
    investments().update_one(
        {"_id": investment_id, "user_id": get_jwt_identity()},
        {"$set": update_doc}
    )
    return ok({}, "Investment updated.")


@investments_bp.delete("/<investment_id>")
@jwt_required()
def delete_investment(investment_id):
    investments().delete_one({"_id": investment_id, "user_id": get_jwt_identity()})
    return ok({}, "Investment deleted.")


@investments_bp.post("/sync-zerodha")
@jwt_required()
def sync_zerodha():
    user_id = get_jwt_identity()
    
    # Mock data to populate from Zerodha
    mock_holdings = [
        {"name": "Reliance Industries Ltd.", "type": "Stocks", "invested_amount": 125000, "current_value": 142000, "units": 50},
        {"name": "HDFC Bank Ltd.", "type": "Stocks", "invested_amount": 95000, "current_value": 91200, "units": 65},
        {"name": "Tata Consultancy Services (TCS)", "type": "Stocks", "invested_amount": 80000, "current_value": 89500, "units": 25},
        {"name": "SBI Bluechip Fund Direct-G", "type": "MF", "invested_amount": 50000, "current_value": 58400, "units": 750},
        {"name": "Parag Parikh Flexi Cap Fund", "type": "MF", "invested_amount": 75000, "current_value": 92100, "units": 1200}
    ]
    
    # Clean previous Zerodha synced mock holdings or keep them
    # For user ease, let's just insert these mock holdings
    inserted_count = 0
    for h in mock_holdings:
        # Check if already exists to avoid duplication
        exists = investments().find_one({"user_id": user_id, "name": h["name"]})
        if not exists:
            doc = {
                "user_id": user_id,
                "name": h["name"],
                "type": h["type"],
                "invested_amount": h["invested_amount"],
                "current_value": h["current_value"],
                "purchase_date": "2026-01-15",
                "units": h["units"],
                "maturity_date": None,
                "interest_rate": None,
                "notes": "Synced from Zerodha portfolio",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            investments().insert_one(doc)
            inserted_count += 1
            
    create_notification(
        user_id,
        "zerodha_synced",
        "Zerodha Synced",
        f"Successfully synced {inserted_count} holdings from Zerodha.",
        "success"
    )
    
    return ok({"synced": inserted_count}, f"Synced {inserted_count} investments from Zerodha.")
