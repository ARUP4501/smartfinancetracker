import csv
import io
from flask import Blueprint, request, Response, current_app
from flask_jwt_extended import get_jwt_identity

from app.models.collections import transactions, users, budgets, goals, categories, notifications
from app.utils.responses import ok, fail
from app.utils.security import admin_required
from app.extensions import database

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/summary")
@admin_required
def summary():
    from collections import defaultdict
    import datetime
    
    # 1. Total Metrics
    total_income = sum(item.get("amount", 0) for item in transactions().find({"type": "income"}))
    total_expense = sum(item.get("amount", 0) for item in transactions().find({"type": "expense"}))
    
    # 2. User Growth by Month
    user_growth = defaultdict(int)
    for u in users().find({}):
        created = u.get("created_at")
        if hasattr(created, "strftime"):
            month = created.strftime("%b %Y")
            user_growth[month] += 1
            
    # Sort months chronologically if possible, or just return dict
    # Since sqlite doesn't always parse well, we'll just return raw counts and let JS sort if needed, but dict items maintain insertion order in python 3.7+
    
    # 3. Category Breakdown
    category_totals = defaultdict(float)
    # 4. Activity Flow (Timeline)
    activity_timeline = defaultdict(lambda: {"income": 0, "expense": 0})
    
    for tx in transactions().find({}):
        cat = tx.get("category", "Other")
        amount = tx.get("amount", 0)
        category_totals[cat] += amount
        
        date = tx.get("date")
        if hasattr(date, "strftime"):
            month = date.strftime("%b %Y")
            tx_type = tx.get("type", "expense")
            activity_timeline[month][tx_type] += amount

    return ok(
        {
            "total_users": users().count_documents({}),
            "total_transactions": transactions().count_documents({}),
            "total_revenue_tracked": round(total_income + total_expense, 2),
            "net_balance_tracked": round(total_income - total_expense, 2),
            "user_growth": dict(user_growth),
            "category_totals": dict(category_totals),
            "activity_timeline": dict(activity_timeline)
        }
    )


@admin_bp.get("/users")
@admin_required
def list_users():
    items = []
    for user in users().find({}).sort("created_at", -1):
        items.append(
            {
                "_id": user["_id"],
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role", "user"),
                "status": user.get("status", "active"),
                "created_at": user.get("created_at"),
                "transactions": transactions().count_documents({"user_id": str(user["_id"])}),
            }
        )
    return ok({"items": items})


@admin_bp.get("/transactions")
@admin_required
def list_transactions():
    tx_type = request.args.get("type")
    query = {}
    if tx_type in {"income", "expense"}:
        query["type"] = tx_type
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    cursor = transactions().find(query).sort("date", -1).skip((page - 1) * limit).limit(limit)
    return ok({"items": list(cursor), "page": page, "limit": limit, "total": transactions().count_documents(query)})


@admin_bp.post("/users/<user_id>/role")
@admin_required
def update_role(user_id):
    current_admin_id = get_jwt_identity()
    if current_admin_id == user_id:
        return fail("You cannot modify your own administrative role.", 400)
    payload = request.get_json() or {}
    new_role = payload.get("role")
    if new_role not in {"admin", "user"}:
        return fail("Invalid role.", 400)
    res = users().update_one({"_id": user_id}, {"$set": {"role": new_role}})
    if res.matched_count == 0:
        return fail("User not found.", 404)
    return ok({}, f"Role updated to {new_role} successfully.")


@admin_bp.post("/users/<user_id>/status")
@admin_required
def update_status(user_id):
    current_admin_id = get_jwt_identity()
    if current_admin_id == user_id:
        return fail("You cannot suspend your own administrative account.", 400)
    payload = request.get_json() or {}
    new_status = payload.get("status")
    if new_status not in {"active", "suspended"}:
        return fail("Invalid status.", 400)
    res = users().update_one({"_id": user_id}, {"$set": {"status": new_status}})
    if res.matched_count == 0:
        return fail("User not found.", 404)
    return ok({}, f"User status updated to {new_status} successfully.")


@admin_bp.post("/users/<user_id>/reset-password")
@admin_required
def reset_password(user_id):
    from app.extensions import bcrypt
    password_hash = bcrypt.generate_password_hash("Temp123!").decode("utf-8")
    res = users().update_one({"_id": user_id}, {"$set": {"password_hash": password_hash}})
    if res.matched_count == 0:
        return fail("User not found.", 404)
    return ok({}, "Password reset to Temp123! successfully.")


@admin_bp.delete("/users/<user_id>")
@admin_required
def delete_user(user_id):
    current_admin_id = get_jwt_identity()
    if current_admin_id == user_id:
        return fail("You cannot delete your own administrative account.", 400)
        
    res = users().delete_one({"_id": user_id})
    if res.deleted_count == 0:
        return fail("User not found.", 404)
        
    # Recursive deletion to maintain database integrity
    transactions().delete_many({"user_id": user_id})
    budgets().delete_many({"user_id": user_id})
    goals().delete_many({"user_id": user_id})
    categories().delete_many({"user_id": user_id})
    notifications().delete_many({"user_id": user_id})
    
    return ok({}, "User and all associated data deleted successfully.")


@admin_bp.get("/users/export")
@admin_required
def export_users():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Name", "Email", "Role", "Status", "Joined At"])
    
    for u in users().find({}):
        writer.writerow([
            u.get("_id"),
            u.get("name"),
            u.get("email"),
            u.get("role", "user"),
            u.get("status", "active"),
            u.get("created_at").isoformat() if hasattr(u.get("created_at"), "isoformat") else str(u.get("created_at", ""))
        ])
        
    response = Response(output.getvalue(), mimetype="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=users_export.csv"
    return response


@admin_bp.get("/transactions/export")
@admin_required
def export_transactions():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "User ID", "Description", "Category", "Type", "Amount"])
    
    for t in transactions().find({}):
        writer.writerow([
            t.get("_id"),
            t.get("date").isoformat() if hasattr(t.get("date"), "isoformat") else str(t.get("date", "")),
            t.get("user_id"),
            t.get("description"),
            t.get("category"),
            t.get("type"),
            t.get("amount")
        ])
        
    response = Response(output.getvalue(), mimetype="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=transactions_export.csv"
    return response


@admin_bp.get("/maintenance")
@admin_required
def get_maintenance():
    settings_col = database.db.system_settings
    settings = settings_col.find_one({"_id": "maintenance_mode"})
    enabled = settings.get("enabled", False) if settings else False
    return ok({"enabled": enabled})


@admin_bp.post("/maintenance")
@admin_required
def toggle_maintenance():
    payload = request.get_json() or {}
    enabled = bool(payload.get("enabled"))
    
    settings_col = database.db.system_settings
    settings = settings_col.find_one({"_id": "maintenance_mode"})
    if not settings:
        settings_col.insert_one({"_id": "maintenance_mode", "enabled": enabled})
    else:
        settings_col.update_one({"_id": "maintenance_mode"}, {"$set": {"enabled": enabled}})
        
    return ok({"enabled": enabled}, f"Maintenance mode {'enabled' if enabled else 'disabled'} successfully.")


@admin_bp.get("/alerts")
@admin_required
def get_alerts():
    # Scan for high value transactions (> 50000)
    high_value_tx = list(transactions().find({"amount": {"$gte": 50000}}))
    alerts_list = []
    
    user_cache = {}
    for tx in high_value_tx:
        if tx.get("admin_acknowledged"): continue
        u_id = tx.get("user_id")
        if u_id not in user_cache:
            u = users().find_one({"_id": u_id})
            user_cache[u_id] = u.get("email") if u else "Unknown User"
            
        alerts_list.append({
            "id": tx.get("_id"),
            "user_email": user_cache[u_id],
            "amount": tx.get("amount"),
            "type": tx.get("type"),
            "description": tx.get("description"),
            "date": tx.get("date").isoformat() if hasattr(tx.get("date"), "isoformat") else str(tx.get("date", ""))
        })
        
    return ok({"items": alerts_list})


@admin_bp.post("/alerts/<tx_id>/dismiss")
@admin_required
def dismiss_alert(tx_id):
    transactions().update_one({"_id": tx_id}, {"$set": {"admin_acknowledged": True}})
    return ok({}, "Alert dismissed")
