import re

INCOME_WORDS = ("credited", "credit", "received", "deposited", "salary", "refund")
EXPENSE_WORDS = ("debited", "debit", "spent", "paid", "withdrawn", "purchase")


def parse_bank_message(message):
    text = (message or "").strip()
    amount_match = re.search(r"(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    if not amount_match:
        amount_match = re.search(r"([0-9,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)", text, re.IGNORECASE)
    if not amount_match:
        amount_match = re.search(r"\b([0-9,]+(?:\.\d{1,2})?)\b", text)
    if not amount_match:
        return None

    lowered = text.lower()
    transaction_type = None
    if any(word in lowered for word in INCOME_WORDS):
        transaction_type = "income"
    if any(word in lowered for word in EXPENSE_WORDS):
        transaction_type = "expense"
    if not transaction_type:
        transaction_type = "expense"

    amount = float(amount_match.group(1).replace(",", ""))
    category = "Other"
    if "salary" in lowered:
        category = "Salary"
    elif "food" in lowered or "restaurant" in lowered:
        category = "Food"
    elif "travel" in lowered or "uber" in lowered or "ola" in lowered:
        category = "Travel"
    elif "shopping" in lowered or "amazon" in lowered or "flipkart" in lowered:
        category = "Shopping"

    return {
        "type": transaction_type,
        "amount": amount,
        "category": category,
        "description": text,
        "source": "smart_parser",
    }
