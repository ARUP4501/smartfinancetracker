from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app.models.collections import budgets, goals, transactions


def monthly_points(user_id, transaction_type, months=6):
    now = datetime.now(timezone.utc)
    labels = []
    values = []
    for offset in reversed(range(months)):
        marker = now.replace(day=1) - timedelta(days=offset * 31)
        key = marker.strftime("%Y-%m")
        labels.append(marker.strftime("%b %Y"))
        start = datetime.strptime(key + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end = (start + timedelta(days=32)).replace(day=1)
        total = sum(
            item["amount"]
            for item in transactions().find({"user_id": user_id, "type": transaction_type, "date": {"$gte": start, "$lt": end}})
        )
        values.append(round(total, 2))
    return {"labels": labels, "values": values}


def category_expenses(user_id):
    totals = defaultdict(float)
    for item in transactions().find({"user_id": user_id, "type": "expense"}):
        totals[item.get("category", "Other")] += item["amount"]
    return {"labels": list(totals.keys()), "values": [round(value, 2) for value in totals.values()]}


def analytics_payload(user_id):
    income = monthly_points(user_id, "income")
    expense = monthly_points(user_id, "expense")
    budget_docs = list(budgets().find({"user_id": user_id}))
    goal_docs = list(goals().find({"user_id": user_id}))
    return {
        "monthly_spending": expense,
        "monthly_income": income,
        "category_expenses": category_expenses(user_id),
        "income_vs_expense": {"labels": income["labels"], "income": income["values"], "expense": expense["values"]},
        "budget_utilization": {
            "labels": [item.get("category", "Overall") for item in budget_docs],
            "values": [item.get("amount", 0) for item in budget_docs],
        },
        "savings_growth": {
            "labels": [item.get("name") for item in goal_docs],
            "values": [round((item.get("current_amount", 0) / item.get("target_amount", 1)) * 100, 2) for item in goal_docs],
        },
    }
