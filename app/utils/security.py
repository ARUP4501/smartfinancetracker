import re
from functools import wraps

from email_validator import EmailNotValidError, validate_email
from flask import current_app
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.extensions import database
from app.utils.responses import fail


def normalize_email(email):
    try:
        return validate_email(email, check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        return None


def password_errors(password):
    errors = []
    if len(password or "") < 8:
        errors.append("Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password or ""):
        errors.append("Password must include an uppercase letter.")
    if not re.search(r"[a-z]", password or ""):
        errors.append("Password must include a lowercase letter.")
    if not re.search(r"\d", password or ""):
        errors.append("Password must include a number.")
    if not re.search(r"[^A-Za-z0-9]", password or ""):
        errors.append("Password must include a special character.")
    return errors


def current_user_id():
    return get_jwt_identity()


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        email = claims.get("email", "").lower()
        if not claims.get("is_admin") and email != current_app.config["ADMIN_EMAIL"]:
            return fail("Admin access required.", 403)
        return fn(*args, **kwargs)

    return wrapper


def user_collection():
    return database.db.users
