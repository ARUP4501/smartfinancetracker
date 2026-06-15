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


def get_daily_advice(user_id):
    from datetime import datetime
    from app.models.collections import users, investments

    user = users().find_one({"_id": user_id}) or {}
    currency = user.get("currency", "₹")

    # Get financial summaries
    from app.services.finance import dashboard_summary
    summary = dashboard_summary(user_id)
    
    expenses = summary.get("total_expenses", 0)
    income = summary.get("total_income", 0)
    savings = summary.get("monthly_savings", 0)
    budget_alerts = summary.get("budget_alerts", [])
    goals_list = summary.get("goals", [])

    advices = []

    # Check Condition 1: High utilization budgets (Danger zone >= 90%)
    high_use_budgets = [b for b in budget_alerts if b.get("usage", 0) >= 90]
    if high_use_budgets:
        highest = max(high_use_budgets, key=lambda x: x.get("usage", 0))
        cat = highest.get("category", "Overall")
        usage = highest.get("usage", 0)
        advices.append({
            "title": "AI Budget Alert",
            "message": f"Your {cat} budget is at {usage:.0f}% capacity. Try to curb spending in this category today to avoid crossing limits!",
            "severity": "danger",
            "action_text": "Manage Budgets",
            "action_url": "/budgets"
        })

    # Check Condition 2: High monthly expenses over income (saving leak)
    if expenses > income and income > 0:
        over_spent = expenses - income
        advices.append({
            "title": "AI Cash Flow Alert",
            "message": f"Attention: Your expenses this month exceed your income by {currency}{over_spent:,.2f}. Let's cut back on non-essential spending today.",
            "severity": "warning",
            "action_text": "Audit Transactions",
            "action_url": "/transactions"
        })

    # Check Condition 3: No Active Savings Goals created
    if not goals_list:
        advices.append({
            "title": "AI Savings Goal Tip",
            "message": "You haven't set any financial savings goals yet. Creating goal targets helps you save up to 20% faster!",
            "severity": "info",
            "action_text": "Create First Goal",
            "action_url": "/goals"
        })

    # Check Condition 4: Healthy savings but no investments tracked
    investment_count = investments().count_documents({"user_id": user_id})
    if savings > 5000 and investment_count == 0:
        advices.append({
            "title": "AI Investment Advice",
            "message": f"Great job! You saved {currency}{savings:,.2f} this month. Consider starting low-risk mutual fund or FD investments to compound your savings.",
            "severity": "success",
            "action_text": "Log First Investment",
            "action_url": "/investments"
        })

    # Check Condition 5: Normal day-of-week advisor wisdom
    day_num = datetime.now().weekday()
    wisdom_tips = [
        # Monday
        {
            "title": "AI Monday Advice",
            "message": "Start your week strong! Take 2 minutes today to review your planned budgets and make sure you track all weekend expenses.",
            "severity": "info",
            "action_text": "Check Dashboard",
            "action_url": "/dashboard"
        },
        # Tuesday
        {
            "title": "AI Smart Rule Advice",
            "message": "Have you heard of the 50/30/20 rule? Allocate 50% for Needs, 30% for Wants, and 20% for Savings. Try auditing your ratios today.",
            "severity": "success",
            "action_text": "View Analytics",
            "action_url": "/analytics"
        },
        # Wednesday
        {
            "title": "AI Wednesday Wisdom",
            "message": "Building an emergency fund of 3-6 months of expenses is the foundation of wealth. Make sure you separate this cash from your daily wallets.",
            "severity": "info",
            "action_text": "Manage Wallets",
            "action_url": "/settings"
        },
        # Thursday
        {
            "title": "AI Budget Review",
            "message": "We are heading towards the weekend soon. Check your remaining budget capacities today to plan ahead.",
            "severity": "warning",
            "action_text": "Check Budgets",
            "action_url": "/budgets"
        },
        # Friday
        {
            "title": "AI Friday Alert",
            "message": "Weekends are when impulse dining and shopping peak. Set a fixed cash spending limit for this weekend to keep your savings safe!",
            "severity": "warning",
            "action_text": "Add Pocket Budget",
            "action_url": "/budgets"
        },
        # Saturday
        {
            "title": "AI Weekend Tip",
            "message": "Always 'Pay Yourself First'. Put your savings target away as soon as you receive income, rather than saving what is left over.",
            "severity": "success",
            "action_text": "Check Savings Goals",
            "action_url": "/goals"
        },
        # Sunday
        {
            "title": "AI Sunday Review",
            "message": "Reflect on your spending this week. Are there any subscription services or impulse purchases you can cut? Small cuts add up to huge savings.",
            "severity": "info",
            "action_text": "Review Transactions",
            "action_url": "/transactions"
        }
    ]
    
    advices.append(wisdom_tips[day_num])
    
    # Add other weekday wisdom tips for cycle variety if the list is short
    import random
    other_tips = [tip for idx, tip in enumerate(wisdom_tips) if idx != day_num]
    random.shuffle(other_tips)
    while len(advices) < 4 and other_tips:
        advices.append(other_tips.pop())

    return advices
