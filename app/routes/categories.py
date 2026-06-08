from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.models.collections import database
from app.utils.responses import fail, ok

categories_bp = Blueprint("categories", __name__)

STANDARD_EXPENSE = [
    {"name": "Food", "icon": "bi-cup-hot", "color": "orange", "emoji": "🍔", "is_custom": False},
    {"name": "Travel", "icon": "bi-airplane", "color": "gold", "emoji": "✈️", "is_custom": False},
    {"name": "Shopping", "icon": "bi-bag", "color": "pink", "emoji": "🛍️", "is_custom": False},
    {"name": "Bills", "icon": "bi-receipt", "color": "blue", "emoji": "🧾", "is_custom": False},
    {"name": "Entertainment", "icon": "bi-ticket-perforated", "color": "violet", "emoji": "🎬", "is_custom": False},
    {"name": "Healthcare", "icon": "bi-heart-pulse", "color": "rose", "emoji": "🏥", "is_custom": False},
    {"name": "Education", "icon": "bi-book", "color": "cyan", "emoji": "📚", "is_custom": False},
    {"name": "Other", "icon": "bi-card-list", "color": "blue", "emoji": "💳", "is_custom": False},
]

STANDARD_INCOME = [
    {"name": "Salary", "icon": "bi-cash-coin", "color": "green", "emoji": "💰", "is_custom": False},
    {"name": "Freelancing", "icon": "bi-briefcase", "color": "teal", "emoji": "💼", "is_custom": False},
    {"name": "Business", "icon": "bi-building", "color": "violet", "emoji": "🏢", "is_custom": False},
    {"name": "Investments", "icon": "bi-graph-up-arrow", "color": "green", "emoji": "📈", "is_custom": False},
    {"name": "Scholarship", "icon": "bi-mortarboard", "color": "cyan", "emoji": "🎓", "is_custom": False},
    {"name": "Other", "icon": "bi-cash-stack", "color": "blue", "emoji": "💳", "is_custom": False},
]

def categories():
    return database.db.categories

@categories_bp.get("/")
@jwt_required()
def list_categories():
    user_id = get_jwt_identity()
    custom_cats = list(categories().find({"user_id": user_id}))
    
    expense_cats = list(STANDARD_EXPENSE)
    income_cats = list(STANDARD_INCOME)
    
    for c in custom_cats:
        cat_data = {
            "_id": c["_id"],
            "name": c["name"],
            "icon": c.get("icon", "bi-tag"),
            "color": c.get("color", "blue"),
            "emoji": c.get("emoji", "🏷️"),
            "is_custom": True
        }
        if c.get("type") == "income":
            income_cats.append(cat_data)
        else:
            expense_cats.append(cat_data)
            
    return ok({"expense": expense_cats, "income": income_cats})

@categories_bp.post("/")
@jwt_required()
def create_category():
    user_id = get_jwt_identity()
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    cat_type = (payload.get("type") or "expense").strip().lower()
    icon = (payload.get("icon") or "bi-tag").strip()
    color = (payload.get("color") or "blue").strip()
    
    if not name:
        return fail("Category name is required.", 422)
    if cat_type not in ["expense", "income"]:
        return fail("Type must be either expense or income.", 422)
        
    # Check duplicate in standard categories
    standards = STANDARD_INCOME if cat_type == "income" else STANDARD_EXPENSE
    if any(s["name"].lower() == name.lower() for s in standards):
        return fail("Category already exists.", 409)
        
    # Check duplicate in custom categories for this user
    if categories().find_one({"user_id": user_id, "name": name, "type": cat_type}):
        return fail("Category already exists.", 409)
        
    # Map icon to a reasonable emoji if possible, or use a default tag emoji
    icon_emoji_map = {
        "bi-cup-hot": "🍔", "bi-airplane": "✈️", "bi-bag": "🛍️", "bi-receipt": "🧾",
        "bi-ticket-perforated": "🎬", "bi-heart-pulse": "🏥", "bi-book": "📚",
        "bi-cash-coin": "💰", "bi-briefcase": "💼", "bi-building": "🏢",
        "bi-graph-up-arrow": "📈", "bi-mortarboard": "🎓", "bi-cash-stack": "💵",
        "bi-house-door": "🏠", "bi-car-front": "🚗", "bi-coffee": "☕", "bi-basket": "🧺",
        "bi-cart3": "🛒", "bi-gift": "🎁", "bi-heart": "❤️", "bi-scissors": "💇",
        "bi-music-note": "🎵", "bi-controller": "🎮", "bi-telephone": "📞",
        "bi-wifi": "📶", "bi-lightning": "⚡", "bi-droplet": "💧",
        "bi-capsule": "💊", "bi-activity": "❤️", "bi-bus-front": "🚌",
        "bi-train-front": "🚆", "bi-ship": "🚢", "bi-fuel-pump": "⛽", "bi-currency-dollar": "💵",
        "bi-piggy-bank": "🐷", "bi-wallet2": "👛", "bi-credit-card": "💳"
    }
    emoji = icon_emoji_map.get(icon, "🏷️")
    
    doc = {
        "user_id": user_id,
        "name": name,
        "type": cat_type,
        "icon": icon,
        "color": color,
        "emoji": emoji,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    categories().insert_one(doc)
    return ok(doc, "Category created.", 201)

@categories_bp.delete("/<cat_id>")
@jwt_required()
def delete_category(cat_id):
    user_id = get_jwt_identity()
    res = categories().delete_one({"_id": cat_id, "user_id": user_id})
    if res.deleted_count == 0:
        return fail("Category not found or access denied.", 404)
    return ok({}, "Category deleted.")
