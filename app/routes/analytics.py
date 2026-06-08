import os
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.services.analytics import analytics_payload
from app.services.finance import dashboard_summary
from app.services.insights import generate_insights
from app.utils.responses import ok

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/")
@jwt_required()
def analytics():
    return ok(analytics_payload(get_jwt_identity()))


@analytics_bp.get("/dashboard")
@jwt_required()
def dashboard():
    return ok(dashboard_summary(get_jwt_identity(), request.args.get("date"), request.args.get("period")))


@analytics_bp.get("/insights")
@jwt_required()
def insights():
    return ok({"items": generate_insights(get_jwt_identity())})


@analytics_bp.post("/chat")
@jwt_required()
def chat_advisor():
    user_id = get_jwt_identity()
    message = request.json.get("message", "").strip()
    if not message:
        return ok({"reply": "Please type a question first."})

    from app.services.analytics import analytics_payload
    from app.services.insights import generate_insights
    from app.models.collections import users
    
    try:
        user = users().find_one({"_id": user_id}) or {}
        payload = analytics_payload(user_id)
        insights_data = generate_insights(user_id)
    except Exception:
        user = {}
        payload = {}
        insights_data = []
        
    profession = user.get("profession", "Salaried")
    risk_profile = user.get("risk_profile", "Moderate")
    income_goal = user.get("monthly_income_goal", 0)
    ai_tone = user.get("ai_tone", "Professional")

    income_values = payload.get("monthly_income", {}).get("values", [])
    expense_values = payload.get("monthly_spending", {}).get("values", [])
    total_income = sum(income_values)
    total_expense = sum(expense_values)
    savings_rate = round(((total_income - total_expense) / total_income) * 100, 1) if total_income else 0
    
    categories = payload.get("category_expenses", {})
    category_list = []
    if categories:
        labels = categories.get("labels", [])
        values = categories.get("values", [])
        for i in range(min(len(labels), len(values))):
            category_list.append(f"{labels[i]}: ₹{values[i]:,.2f}")
            
    system_prompt = f"""You are "SmartFinance AI", a professional, friendly, and knowledgeable personal finance and investment advisor built into a financial app for Indian users.

User's Profile & Financial Summary:
- Profession: {profession}
- Risk Tolerance Profile: {risk_profile}
- Monthly Income Goal: ₹{income_goal:,.2f}
- AI Advisor Response Tone: {ai_tone}
- Total Income (this period): ₹{total_income:,.2f}
- Total Expenses (this period): ₹{total_expense:,.2f}  
- Savings Rate: {savings_rate}%
- Spending by Category:
  {chr(10).join(f'  • {c}' for c in category_list) if category_list else '  No category data yet.'}
- Active Alerts:
  {chr(10).join(f'  • {item["title"]}: {item["message"]}' for item in insights_data) if insights_data else '  No active alerts.'}

Your Capabilities — You can advise on ALL of these topics:
1. **Savings & Budgeting** — How to save more, reduce expenses, set budgets
2. **Stock Investments** — Indian stocks (NSE/BSE), sectors to invest in, blue-chip stocks, growth stocks
3. **Mutual Funds & SIPs** — Best mutual funds, SIP recommendations, index funds (Nifty 50, Sensex)
4. **Fixed Income** — FDs, PPF, NPS, bonds, government schemes
5. **General Financial Planning** — Emergency fund, tax saving (80C), insurance
6. **Market Insights** — General market trends, sector analysis

Instructions:
- Be concise but insightful (3-5 sentences or 3-5 bullet points).
- Reference the user's actual financial numbers wherever relevant.
- Use markdown: **bold** for key terms/numbers, bullet points (- ) for lists.
- For stocks/investments, give specific Indian examples (e.g. Reliance, TCS, HDFC Bank, Nifty 50 index funds).
- Always add a disclaimer for stock advice: mention it's for educational purposes and user should consult a SEBI-registered advisor for final decisions.
- Adapt your response tone to be **{ai_tone}** (e.g. if Casual, use warm, daily, friendly tone; if Professional, be formal, concise and authoritative; if Aggressive, be very direct and push hard for savings; if Encouraging, focus on praising small improvements and being highly supportive).
- If user has no financial data yet, give general advice and encourage them to add transactions.
"""
    
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key and api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            import json
            import urllib.request
            
            # Build the request payload for Gemini REST API
            full_prompt = f"{system_prompt}\n\nUser Question: {message}"
            payload = {
                "contents": [
                    {
                        "parts": [{"text": full_prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 1024,
                }
            }
            
            # Try models in order - these are confirmed available for this key
            models_to_try = [
                "gemini-2.0-flash",
                "gemini-2.5-flash",
                "gemini-2.0-flash-lite",
            ]
            response_text = None
            last_err = None
            
            for model_name in models_to_try:
                for attempt in range(2):  # Try twice per model (retry once on 429)
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                        req = urllib.request.Request(
                            url,
                            data=json.dumps(payload).encode("utf-8"),
                            headers={"Content-Type": "application/json"},
                            method="POST"
                        )
                        with urllib.request.urlopen(req, timeout=15) as resp:
                            result = json.loads(resp.read().decode("utf-8"))
                        
                        candidates = result.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and parts[0].get("text"):
                                response_text = parts[0]["text"].strip()
                                break
                        break  # No candidates but no error, move to next model
                    except urllib.error.HTTPError as ex:
                        err_body = ex.read().decode("utf-8") if hasattr(ex, 'read') else str(ex)
                        last_err = f"HTTP {ex.code}: {err_body[:200]}"
                        if ex.code == 429 and attempt == 0:
                            # Rate limited — wait 3 seconds and retry once
                            import time
                            time.sleep(3)
                            continue
                        print(f"[Gemini REST] Model {model_name} failed: {last_err}")
                        break
                    except Exception as ex:
                        last_err = str(ex)
                        print(f"[Gemini REST] Model {model_name} error: {ex}")
                        break
                if response_text:
                    break
            
            if response_text:
                return ok({"reply": response_text})
            else:
                print("[Gemini REST] All models failed. Last error:", last_err)
        except Exception as ex:
            print("[Gemini REST] Unexpected error:", ex)
    else:
        if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
            print("[Gemini] No valid GEMINI_API_KEY set. Using fallback.")
            
    reply = local_fallback_chat(message, total_income, total_expense, savings_rate)
    return ok({"reply": reply})


def local_fallback_chat(message, income, expense, savings_rate):
    lower = message.lower()
    
    def money(v):
        return f"₹{v:,.2f}"
        
    if "save" in lower or "saving" in lower or "invest" in lower or "bachat" in lower:
        return f"Analyzing savings... Currently, your savings rate is **{savings_rate}%** (Income: {money(income)}, Expenses: {money(expense)}). " + \
               (f"This is healthy! We suggest routing at least 10% to index funds to build assets." if savings_rate >= 20 
                else "This is below the recommended 20% mark. Try cutting down discretionary spending like Shopping or Entertainment in the Budgets panel.")
    elif "spend" in lower or "expense" in lower or "kharach" in lower or "buy" in lower or "cost" in lower:
        disc = round(expense * 0.25)
        return f"Scanning expenses... You spent **{money(expense)}** this month. Cutting down shopping/dining out by 15% could save you around **{money(disc)}** per month."
    elif "budget" in lower or "limit" in lower:
        return "Checking budgets... We suggest setting category-specific limits on Food and Shopping in the **Budgets** panel to get automatically warned at 80% and 90% usage."
    else:
        return f"I've scanned your wallet. Your active figures: Income: **{money(income)}**, Expenses: **{money(expense)}**, Savings Rate: **{savings_rate}%**. Please set category limits in Budgets for active tracking."
