from datetime import datetime, timedelta, timezone

from app.models.collections import budgets, goals, transactions
from app.services.notifications import create_notification


def month_key(dt=None):
    value = dt or datetime.now(timezone.utc)
    return value.strftime("%Y-%m")


def month_bounds(dt=None):
    value = dt or datetime.now(timezone.utc)
    current_start = value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if current_start.month == 1:
        previous_start = current_start.replace(year=current_start.year - 1, month=12)
    else:
        previous_start = current_start.replace(month=current_start.month - 1)
    if current_start.month == 12:
        next_start = current_start.replace(year=current_start.year + 1, month=1)
    else:
        next_start = current_start.replace(month=current_start.month + 1)
    return current_start, previous_start, next_start


def percentage_change(current, previous, lower_is_better=False):
    current = float(current or 0)
    previous = float(previous or 0)
    if previous == 0:
        if current == 0:
            return {"value": 0, "direction": "flat", "label": "0%"}
        is_positive = current > 0
        if is_positive:
            direction = "down" if lower_is_better else "up"
        else:
            direction = "up" if lower_is_better else "down"
        return {"value": 100, "direction": direction, "label": "100%"}
    change = round(((current - previous) / abs(previous)) * 100, 1)
    direction = "down" if change >= 0 else "up"
    if not lower_is_better:
        direction = "up" if change >= 0 else "down"
    return {"value": abs(change), "direction": direction, "label": f"{abs(change):g}%"}


def parse_dashboard_date(value=None):
    if not value:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def day_bounds(value=None):
    selected = parse_dashboard_date(value)
    start = selected.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def financial_health(period_income, period_expense, budget_utilization, cumulative_balance=0.0):
    income = float(period_income or 0)
    expense = float(period_expense or 0)
    budget_usage = float(budget_utilization or 0)
    balance = float(cumulative_balance or 0)

    # 1. Savings Rate Component (up to 40 points)
    if income > 0:
        savings_rate = max(0.0, (income - expense) / income)
        savings_points = min(40.0, (savings_rate / 0.2) * 40.0)
    else:
        if expense == 0:
            savings_points = 40.0
        else:
            if balance > 0:
                runway = balance / expense
                savings_points = min(30.0, (runway / 6.0) * 30.0)
            else:
                savings_points = 0.0

    # 2. Runway Component (up to 30 points)
    if expense > 0:
        if balance > 0:
            runway = balance / expense
            runway_points = min(30.0, (runway / 6.0) * 30.0)
        else:
            runway_points = 0.0
    else:
        runway_points = 30.0 if balance >= 0 else 0.0

    # 3. Budget Adherence Component (up to 20 points)
    if budget_usage == 0:
        budget_points = 20.0
    elif budget_usage <= 80.0:
        budget_points = 20.0
    elif budget_usage <= 100.0:
        budget_points = 20.0 - ((budget_usage - 80.0) / 20.0) * 10.0
    else:
        budget_points = max(0.0, 10.0 - ((budget_usage - 100.0) / 40.0) * 10.0)

    # 4. Base Stability Component (10 points)
    base_points = 10.0 if (income > 0 or balance > 0) else 5.0

    score = max(0, min(100, round(savings_points + runway_points + budget_points + base_points)))

    if score >= 80:
        return {"score": score, "status": "Great", "message": "Keep it up! You are doing great with your finances."}
    if score >= 65:
        return {"score": score, "status": "Good", "message": "Your finances are stable. Keep tracking expenses."}
    if score >= 45:
        return {"score": score, "status": "Fair", "message": "Your spending needs attention for this date."}
    return {"score": score, "status": "Risk", "message": "Expenses are high compared to income for this date."}


def income_expense_points(user_id, anchor_date=None, months=6):
    anchor = parse_dashboard_date(anchor_date).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    labels = []
    income_values = []
    expense_values = []
    for offset in reversed(range(months)):
        marker = anchor - timedelta(days=offset * 31)
        start = marker.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        labels.append(start.strftime("%b %Y"))
        items = list(transactions().find({"user_id": user_id, "date": {"$gte": start, "$lt": end}}))
        income_values.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
        expense_values.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))
    return {"labels": labels, "income": income_values, "expense": expense_values}


def period_points(user_id, anchor_date=None):
    anchor = parse_dashboard_date(anchor_date)
    day_labels = []
    day_income = []
    day_expense = []
    for offset in reversed(range(7)):
        start = anchor.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=offset)
        end = start + timedelta(days=1)
        items = list(transactions().find({"user_id": user_id, "date": {"$gte": start, "$lt": end}}))
        day_labels.append(start.strftime("%d %b"))
        day_income.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
        day_expense.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))

    week_labels = []
    week_income = []
    week_expense = []
    week_start = (anchor - timedelta(days=anchor.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    for offset in reversed(range(8)):
        start = week_start - timedelta(weeks=offset)
        end = start + timedelta(days=7)
        items = list(transactions().find({"user_id": user_id, "date": {"$gte": start, "$lt": end}}))
        week_labels.append(start.strftime("%d %b"))
        week_income.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
        week_expense.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))

    month = income_expense_points(user_id, anchor, 6)
    return {
        "day": {"labels": day_labels, "income": day_income, "expense": day_expense},
        "week": {"labels": week_labels, "income": week_income, "expense": week_expense},
        "month": month,
    }


def parse_date(value):
    if not value:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def compute_balance(user_id):
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    totals = {item["_id"]: item["total"] for item in transactions().aggregate(pipeline)}
    return round(totals.get("income", 0) - totals.get("expense", 0), 2)


def add_transaction(user_id, payload):
    transaction_type = payload.get("type")
    if transaction_type not in {"income", "expense"}:
        raise ValueError("Transaction type must be income or expense.")
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        raise ValueError("Amount must be greater than zero.")

    doc = {
        "user_id": user_id,
        "type": transaction_type,
        "amount": amount,
        "category": payload.get("category") or "Other",
        "description": payload.get("description") or payload.get("category") or "Transaction",
        "date": parse_date(payload.get("date")),
        "wallet": payload.get("wallet") or "Default",
        "source": payload.get("source", "manual"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    inserted = transactions().insert_one(doc)
    doc["_id"] = inserted.inserted_id
    balance = compute_balance(user_id)
    transactions().update_one({"_id": inserted.inserted_id}, {"$set": {"balance_after": balance}})

    if transaction_type == "income":
        create_notification(user_id, "income_added", "Income added", f"₹{amount:,.2f} added to {doc['category']}.", "success")
    else:
        create_notification(user_id, "expense_added", "Expense added", f"₹{amount:,.2f} spent on {doc['category']}.", "info")
        evaluate_budget_alerts(user_id, doc["category"])

    doc["balance_after"] = balance
    return doc


def update_transaction(user_id, transaction_id, payload):
    update = {
        "amount": float(payload.get("amount", 0)),
        "category": payload.get("category") or "Other",
        "description": payload.get("description") or "Transaction",
        "type": payload.get("type"),
        "date": parse_date(payload.get("date")),
        "wallet": payload.get("wallet") or "Default",
        "updated_at": datetime.now(timezone.utc),
    }
    if update["type"] not in {"income", "expense"} or update["amount"] <= 0:
        raise ValueError("Invalid transaction data.")
    transactions().update_one({"_id": transaction_id, "user_id": user_id}, {"$set": update})
    return compute_balance(user_id)


def range_points(user_id, start_date, end_date, interval="day"):
    labels = []
    income_values = []
    expense_values = []
    
    if interval == "day":
        current = start_date
        while current < end_date:
            next_day = current + timedelta(days=1)
            items = list(transactions().find({"user_id": user_id, "date": {"$gte": current, "$lt": next_day}}))
            labels.append(current.strftime("%d %b"))
            income_values.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
            expense_values.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))
            current = next_day
            
    elif interval == "week":
        current = start_date
        while current < end_date:
            next_week = current + timedelta(days=7)
            items = list(transactions().find({"user_id": user_id, "date": {"$gte": current, "$lt": next_week}}))
            labels.append(current.strftime("%d %b"))
            income_values.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
            expense_values.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))
            current = next_week
            
    elif interval == "month":
        current = start_date
        while current < end_date:
            if current.month == 12:
                next_month = current.replace(year=current.year + 1, month=1, day=1)
            else:
                next_month = current.replace(month=current.month + 1, day=1)
            items = list(transactions().find({"user_id": user_id, "date": {"$gte": current, "$lt": next_month}}))
            labels.append(current.strftime("%b %Y"))
            income_values.append(round(sum(item["amount"] for item in items if item["type"] == "income"), 2))
            expense_values.append(round(sum(item["amount"] for item in items if item["type"] == "expense"), 2))
            current = next_month
            
    return {"labels": labels, "income": income_values, "expense": expense_values}


def dashboard_summary(user_id, selected_date=None, period=None):
    now = datetime.now(timezone.utc)
    
    if period == "7":
        end_date = now
        start_date = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_end = start_date
        prev_start = start_date - timedelta(days=7)
        interval = "day"
    elif period == "30":
        end_date = now
        start_date = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_end = start_date
        prev_start = start_date - timedelta(days=30)
        interval = "day"
    elif period == "90":
        end_date = now
        start_date = (now - timedelta(days=90)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_end = start_date
        prev_start = start_date - timedelta(days=90)
        interval = "week"
    elif period == "this-month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1)
        prev_end = start_date
        if start_date.month == 1:
            prev_start = start_date.replace(year=start_date.year - 1, month=12)
        else:
            prev_start = start_date.replace(month=start_date.month - 1)
        interval = "day"
    elif period == "last-month":
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if first_of_this_month.month == 1:
            start_date = first_of_this_month.replace(year=first_of_this_month.year - 1, month=12)
        else:
            start_date = first_of_this_month.replace(month=first_of_this_month.month - 1)
        end_date = first_of_this_month
        prev_end = start_date
        if start_date.month == 1:
            prev_start = start_date.replace(year=start_date.year - 1, month=12)
        else:
            prev_start = start_date.replace(month=start_date.month - 1)
        interval = "day"
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date.replace(year=start_date.year + 1)
        prev_end = start_date
        prev_start = start_date.replace(year=start_date.year - 1)
        interval = "month"
    else:
        # Default to selected_date month (as before)
        selected = parse_dashboard_date(selected_date)
        start_date, prev_start, end_date = month_bounds(selected)
        prev_end = start_date
        interval = "month"

    if period in ["7", "30", "90"]:
        current_month = end_date.strftime("%Y-%m")
    else:
        current_month = start_date.strftime("%Y-%m")
    txns = list(transactions().find({"user_id": user_id}).sort("date", -1))
    
    # Filter transactions for current period and previous comparison period
    period_txns = [item for item in txns if start_date <= item.get("date", start_date) < end_date]
    prev_txns = [item for item in txns if prev_start <= item.get("date", prev_start) < prev_end]

    month_income = sum(item["amount"] for item in period_txns if item["type"] == "income")
    month_expense = sum(item["amount"] for item in period_txns if item["type"] == "expense")
    monthly_savings = round(month_income - month_expense, 2)

    previous_month_income = sum(item["amount"] for item in prev_txns if item["type"] == "income")
    previous_month_expense = sum(item["amount"] for item in prev_txns if item["type"] == "expense")
    previous_monthly_savings = round(previous_month_income - previous_month_expense, 2)

    # Balance up to the end of this period
    income = sum(item["amount"] for item in txns if item["type"] == "income" and item.get("date", end_date) < end_date)
    expenses = sum(item["amount"] for item in txns if item["type"] == "expense" and item.get("date", end_date) < end_date)
    balance = round(income - expenses, 2)

    # Previous balance comparison
    prev_income = sum(item["amount"] for item in txns if item["type"] == "income" and item.get("date", prev_end) < prev_end)
    prev_expenses = sum(item["amount"] for item in txns if item["type"] == "expense" and item.get("date", prev_end) < prev_end)
    previous_month_balance = round(prev_income - prev_expenses, 2)

    # Budget
    if period == "year":
        budget_docs = list(budgets().find({"user_id": user_id, "month": {"$regex": f"^{start_date.year}-"}}))
        budget_total = sum(item.get("amount", 0) for item in budget_docs)
        budget_used = round((month_expense / budget_total) * 100, 2) if budget_total else 0
        budget_usages = build_budget_usage(user_id, current_month)
    else:
        budget_usages = build_budget_usage(user_id, current_month)
        budget_total = sum(item.get("amount", 0) for item in budget_usages)
        budget_used = round((month_expense / budget_total) * 100, 2) if budget_total else 0

    goal_docs = list(goals().find({"user_id": user_id}).sort("created_at", -1))
    health = financial_health(month_income, month_expense, budget_used, balance)

    standard_chart = period_points(user_id, start_date)
    chart_payload = {
        **standard_chart,
        "custom": range_points(user_id, start_date, end_date, interval)
    }

    return {
        "balance": balance,
        "total_income": round(month_income, 2),
        "total_expenses": round(month_expense, 2),
        "monthly_savings": monthly_savings,
        "trends": {
            "balance": percentage_change(balance, previous_month_balance),
            "total_income": percentage_change(month_income, previous_month_income),
            "total_expenses": percentage_change(month_expense, previous_month_expense, lower_is_better=True),
            "monthly_savings": percentage_change(monthly_savings, previous_monthly_savings),
        },
        "selected_date": start_date.date().isoformat(),
        "selected_month": current_month,
        "health": health,
        "chart": chart_payload,
        "budget_utilization": budget_used,
        "recent_transactions": txns[:5],
        "goals": goal_docs[:3],
        "budget_alerts": budget_usages,
    }


CATEGORY_METADATA = {
    "food": {"icon": "bi-cup-hot", "tone": "orange"},
    "food & drink": {"icon": "bi-cup-hot", "tone": "orange"},
    "travel": {"icon": "bi-airplane", "tone": "gold"},
    "transport": {"icon": "bi-car-front", "tone": "gold"},
    "shopping": {"icon": "bi-bag", "tone": "pink"},
    "bills": {"icon": "bi-receipt", "tone": "blue"},
    "entertainment": {"icon": "bi-ticket-perforated", "tone": "violet"},
    "healthcare": {"icon": "bi-heart-pulse", "tone": "rose"},
    "education": {"icon": "bi-book", "tone": "cyan"},
    "salary": {"icon": "bi-cash-coin", "tone": "green"},
    "freelancing": {"icon": "bi-briefcase", "tone": "teal"},
    "business": {"icon": "bi-building", "tone": "violet"},
    "investments": {"icon": "bi-graph-up-arrow", "tone": "green"},
    "overall": {"icon": "bi-bullseye", "tone": "violet"},
    "other": {"icon": "bi-wallet2", "tone": "green"}
}


def build_budget_usage(user_id, selected_month=None):
    current_month = selected_month or month_key()
    month_start = datetime.strptime(current_month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    result = []
    for budget in budgets().find({"user_id": user_id, "month": current_month}):
        period = budget.get("period", "monthly")
        if period == "weekly":
            now = datetime.now(timezone.utc)
            week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            query = {"user_id": user_id, "type": "expense", "date": {"$gte": week_start}}
        else:
            query = {"user_id": user_id, "type": "expense", "date": {"$gte": month_start}}
            
        category = budget.get("category", "Overall")
        is_overall = "Overall" in category or category == ""
        if not is_overall:
            query["category"] = category
        spent = sum(item["amount"] for item in transactions().find(query))
        amount = budget.get("amount", 0)
        
        from app.models.collections import users
        user = users().find_one({"_id": user_id}) or {}
        threshold = float(user.get("budget_warning_threshold", 80))
        orange_threshold = threshold + (100.0 - threshold) / 2.0
        
        usage = round((spent / amount) * 100, 2) if amount else 0
        severity = "ok"
        if usage >= 100:
            severity = "danger"
        elif usage >= orange_threshold:
            severity = "orange"
        elif usage >= threshold:
            severity = "warning"
            
        cat_lower = category.lower().strip()
        meta = CATEGORY_METADATA.get(cat_lower, CATEGORY_METADATA["overall"] if is_overall else CATEGORY_METADATA["other"])
        
        result.append({
            **budget,
            "spent": spent,
            "usage": usage,
            "severity": severity,
            "exceeded_by": max(0, spent - amount),
            "icon": meta["icon"],
            "tone": meta["tone"]
        })
    return result


def evaluate_budget_alerts(user_id, category):
    from app.models.collections import users
    user = users().find_one({"_id": user_id}) or {}
    threshold = float(user.get("budget_warning_threshold", 80))
    
    for item in build_budget_usage(user_id):
        category_name = item.get("category", "Overall")
        is_overall = "Overall" in category_name or category_name == ""
        applies = is_overall or category_name == category
        if not applies or item["usage"] < threshold:
            continue
        severity = "danger" if item["usage"] >= 100 else "warning"
        title = "Budget exceeded" if item["usage"] >= 100 else "Budget usage warning"
        message = f"{item['category']} budget is at {item['usage']}% usage."
        create_notification(user_id, "budget_alert", title, message, severity)
