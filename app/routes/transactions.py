from flask import Blueprint, request, Response
from flask_jwt_extended import get_jwt_identity, jwt_required
import csv
import io
from datetime import datetime, timezone

from app.models.collections import transactions
from pypdf import PdfReader
from app.services.finance import add_transaction, compute_balance, update_transaction, parse_date
from app.services.transaction_parser import parse_bank_message
from app.utils.responses import fail, ok

transactions_bp = Blueprint("transactions", __name__)


@transactions_bp.get("/")
@jwt_required()
def list_transactions():
    user_id = get_jwt_identity()
    query = {"user_id": user_id}
    tx_type = request.args.get("type")
    category = request.args.get("category")
    wallet = request.args.get("wallet")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    search = request.args.get("search")

    if tx_type in {"income", "expense"}:
        query["type"] = tx_type
    if category:
        query["category"] = category
    if wallet:
        query["wallet"] = wallet
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = parse_date(start_date)
        if end_date:
            query["date"]["$lt"] = parse_date(end_date)

    # Fetch matching items (with filters except search)
    all_items = list(transactions().find(query).sort(request.args.get("sort", "date"), -1))

    # Apply search filter across description, category, or amount
    if search:
        search_lower = search.lower().strip()
        filtered_items = []
        for item in all_items:
            desc = str(item.get("description") or "").lower()
            cat = str(item.get("category") or "").lower()
            amt = f"{item.get('amount', 0):.2f}"
            if search_lower in desc or search_lower in cat or search_lower in amt:
                filtered_items.append(item)
        all_items = filtered_items

    # Compute stats over all matching items
    total_expense = sum(item.get("amount", 0) for item in all_items if item.get("type") == "expense")
    total_income = sum(item.get("amount", 0) for item in all_items if item.get("type") == "income")
    net_balance = total_income - total_expense

    total = len(all_items)
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 10)), 1), 50)
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_items = all_items[start_idx:end_idx]

    return ok({
        "items": paginated_items, 
        "page": page, 
        "limit": limit, 
        "total": total,
        "stats": {
            "total_expense": round(total_expense, 2),
            "total_income": round(total_income, 2),
            "net_balance": round(net_balance, 2)
        }
    })


@transactions_bp.post("/")
@jwt_required()
def create_transaction():
    try:
        return ok(add_transaction(get_jwt_identity(), request.get_json() or {}), "Transaction created.", 201)
    except ValueError as exc:
        return fail(str(exc), 422)


@transactions_bp.put("/<transaction_id>")
@jwt_required()
def edit_transaction(transaction_id):
    try:
        balance = update_transaction(get_jwt_identity(), transaction_id, request.get_json() or {})
        return ok({"balance": balance}, "Transaction updated.")
    except ValueError as exc:
        return fail(str(exc), 422)


@transactions_bp.delete("/<transaction_id>")
@jwt_required()
def delete_transaction(transaction_id):
    transactions().delete_one({"_id": transaction_id, "user_id": get_jwt_identity()})
    return ok({"balance": compute_balance(get_jwt_identity())}, "Transaction deleted.")


@transactions_bp.post("/parse")
@jwt_required()
def parse_transaction():
    parsed = parse_bank_message((request.get_json() or {}).get("message", ""))
    if not parsed:
        return fail("Could not detect a credit/debit amount from this message.", 422)
    return ok(parsed, "Smart parser parsed the message.")


@transactions_bp.post("/parse-file")
@jwt_required()
def parse_transaction_file():
    if "file" not in request.files:
        return fail("No file part in the request.", 400)
    file = request.files["file"]
    if file.filename == "":
        return fail("No selected file.", 400)
    
    if not file.filename.lower().endswith(".pdf"):
        return fail("Only PDF files are supported by this endpoint.", 400)
        
    try:
        pdf_file = io.BytesIO(file.read())
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        text = text.strip()
        if not text:
            return fail("Could not extract any text from the PDF file.", 422)
            
        parsed = parse_bank_message(text)
        if not parsed:
            return fail("Could not detect a credit/debit amount from the PDF content.", 422)
            
        if len(parsed.get("description", "")) > 200:
            parsed["description"] = parsed["description"][:197] + "..."
            
        return ok(parsed, "Smart parser parsed the PDF file.")
    except Exception as exc:
        return fail(f"Failed to parse PDF file: {str(exc)}", 422)


@transactions_bp.post("/import")
@jwt_required()
def import_transactions():
    if "file" not in request.files:
        return fail("No file part in the request.", 400)
    file = request.files["file"]
    if file.filename == "":
        return fail("No selected file.", 400)

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        reader = csv.DictReader(stream)
        
        imported_count = 0
        fieldnames_lower = [f.lower().strip() if f else "" for f in (reader.fieldnames or [])]
        has_headers = any(h in fieldnames_lower for h in ["amount", "type", "category", "description", "note"])
        
        if has_headers:
            # Map fieldnames to lowercase for easier lookup
            mapped_fields = {f.lower().strip(): f for f in (reader.fieldnames or []) if f}
            for row in reader:
                # Resolve value by potential column aliases
                amount_field = mapped_fields.get("amount") or mapped_fields.get("value")
                type_field = mapped_fields.get("type") or mapped_fields.get("txn_type")
                cat_field = mapped_fields.get("category")
                desc_field = mapped_fields.get("description") or mapped_fields.get("note")
                date_field = mapped_fields.get("date") or mapped_fields.get("time")
                wallet_field = mapped_fields.get("wallet")
                
                amount_val = row.get(amount_field) if amount_field else 0
                txn_type = row.get(type_field) if type_field else "expense"
                category = row.get(cat_field) if cat_field else "Other"
                description = row.get(desc_field) if desc_field else category
                date_val = row.get(date_field) or datetime.now(timezone.utc).isoformat()
                wallet_val = row.get(wallet_field) or "Default"
                
                if not amount_val or float(amount_val) <= 0:
                    continue
                
                add_transaction(get_jwt_identity(), {
                    "type": txn_type.lower().strip(),
                    "amount": float(amount_val),
                    "category": category.strip(),
                    "description": description.strip(),
                    "date": date_val,
                    "wallet": wallet_val.strip(),
                    "source": "csv_import"
                })
                imported_count += 1
        else:
            # Positional fallback (Date, Description, Category, Type, Amount, Wallet)
            stream.seek(0)
            normal_reader = csv.reader(stream)
            for row in normal_reader:
                if not row or len(row) < 5:
                    continue
                # Skip header-looking rows
                if row[0].lower() in ["date", "time"] or row[4].lower() in ["amount", "value"]:
                    continue
                
                date_val = row[0]
                description = row[1]
                category = row[2]
                txn_type = row[3]
                amount_val = row[4]
                wallet_val = row[5] if len(row) > 5 else "Default"
                
                if not amount_val or float(amount_val) <= 0:
                    continue
                
                add_transaction(get_jwt_identity(), {
                    "type": txn_type.lower().strip(),
                    "amount": float(amount_val),
                    "category": category.strip(),
                    "description": description.strip(),
                    "date": date_val,
                    "wallet": wallet_val.strip(),
                    "source": "csv_import"
                })
                imported_count += 1

        return ok({"imported": imported_count}, f"Successfully imported {imported_count} transactions.")
    except Exception as exc:
        return fail(f"Import failed: {str(exc)}", 422)


@transactions_bp.get("/export")
@jwt_required()
def export_transactions():
    user_id = get_jwt_identity()
    query = {"user_id": user_id}
    tx_type = request.args.get("type")
    category = request.args.get("category")
    wallet = request.args.get("wallet")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    search = request.args.get("search")

    if tx_type in {"income", "expense"}:
        query["type"] = tx_type
    if category:
        query["category"] = category
    if wallet:
        query["wallet"] = wallet
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = parse_date(start_date)
        if end_date:
            query["date"]["$lt"] = parse_date(end_date)

    all_items = list(transactions().find(query).sort("date", -1))

    if search:
        search_lower = search.lower().strip()
        filtered_items = []
        for item in all_items:
            desc = str(item.get("description") or "").lower()
            cat = str(item.get("category") or "").lower()
            amt = f"{item.get('amount', 0):.2f}"
            if search_lower in desc or search_lower in cat or search_lower in amt:
                filtered_items.append(item)
        all_items = filtered_items

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(["Date", "Description", "Category", "Type", "Amount", "Wallet", "Balance After"])
    for item in all_items:
        cw.writerow([
            item.get("date").strftime("%Y-%m-%d %H:%M:%S") if hasattr(item.get("date"), "strftime") else str(item.get("date") or ""),
            item.get("description", ""),
            item.get("category", ""),
            item.get("type", ""),
            item.get("amount", 0),
            item.get("wallet", "Default"),
            item.get("balance_after", 0)
        ])

    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_export.csv"}
    )

