from datetime import datetime, timedelta, timezone

from app.models.collections import financial_insights, transactions


def month_window(month_offset=0):
    now = datetime.now(timezone.utc)
    base = (now.replace(day=1) - timedelta(days=month_offset * 31)).replace(day=1)
    end = (base + timedelta(days=32)).replace(day=1)
    return base, end


def total_for(user_id, transaction_type, start, end, category=None):
    query = {"user_id": user_id, "type": transaction_type, "date": {"$gte": start, "$lt": end}}
    if category:
        query["category"] = category
    return sum(item["amount"] for item in transactions().find(query))


def generate_insights(user_id):
    current_start, current_end = month_window(0)
    previous_start, previous_end = month_window(1)
    income = total_for(user_id, "income", current_start, current_end)
    expenses = total_for(user_id, "expense", current_start, current_end)
    previous_expenses = total_for(user_id, "expense", previous_start, previous_end)
    insights = []

    if previous_expenses and expenses > previous_expenses:
        change = round(((expenses - previous_expenses) / previous_expenses) * 100, 1)
        insights.append({"title": "Spending trend", "message": f"Expenses increased by {change}% compared to last month.", "severity": "warning"})

    for category in ["Food", "Shopping", "Entertainment", "Travel"]:
        current = total_for(user_id, "expense", current_start, current_end, category)
        previous = total_for(user_id, "expense", previous_start, previous_end, category)
        if previous and current > previous * 1.15:
            change = round(((current - previous) / previous) * 100, 1)
            insights.append({"title": f"{category} spending", "message": f"{category} spending increased by {change}% this month.", "severity": "warning"})

    from app.models.collections import users
    user = users().find_one({"_id": user_id}) or {}
    currency = user.get("currency", "₹")

    savings_rate = round(((income - expenses) / income) * 100, 1) if income else 0
    if savings_rate >= 20:
        insights.append({"title": "Savings rate", "message": "Current savings rate is healthy.", "severity": "success"})
    elif income:
        discretionary = total_for(user_id, "expense", current_start, current_end, "Shopping") + total_for(user_id, "expense", current_start, current_end, "Entertainment")
        possible = round(discretionary * 0.3, 2)
        insights.append({"title": "Savings opportunity", "message": f"You can save approximately {currency}{possible:,.2f} this month by reducing discretionary spending.", "severity": "info"})

    if not insights:
        insights.append({"title": "Financial activity", "message": "Add more transactions to unlock detailed financial recommendations.", "severity": "info"})

    financial_insights().delete_many({"user_id": user_id})
    for item in insights:
        item.update({"user_id": user_id, "created_at": datetime.now(timezone.utc)})
        financial_insights().insert_one(item)
    return insights
