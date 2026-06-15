import secrets
from datetime import datetime, timezone, timedelta

from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, set_access_cookies, unset_jwt_cookies

from app.extensions import bcrypt
from app.models.collections import users
from app.utils.responses import fail, ok
from app.utils.security import normalize_email, password_errors
from app.utils.email import send_otp_email, send_reset_password_email


auth_bp = Blueprint("auth", __name__)

AVATAR_THEMES = {"sunset", "ocean", "forest", "violet", "rose", "gold"}


def user_payload(user):
    return {
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "avatar": user.get("avatar", "sunset"),
        "profession": user.get("profession", "Salaried"),
        "currency": user.get("currency", "₹"),
        "risk_profile": user.get("risk_profile", "Moderate"),
        "monthly_income_goal": user.get("monthly_income_goal", 0),
        "budget_warning_threshold": user.get("budget_warning_threshold", 80),
        "default_wallet": user.get("default_wallet", "Default"),
        "ai_tone": user.get("ai_tone", "Professional"),
        "has_onboarded": user.get("has_onboarded", False),
        "notifications_enabled": user.get("notifications_enabled", True),
        "email_alerts_enabled": user.get("email_alerts_enabled", True),
        "weekly_summaries_enabled": user.get("weekly_summaries_enabled", True),
        "budget_warnings_enabled": user.get("budget_warnings_enabled", True),
    }


def issue_user_cookie(user, message="Profile updated."):
    claims = {
        "email": user["email"],
        "name": user["name"],
        "avatar": user.get("avatar", "sunset"),
        "is_admin": user.get("role") == "admin",
        "profession": user.get("profession", "Salaried"),
        "currency": user.get("currency", "₹"),
        "risk_profile": user.get("risk_profile", "Moderate"),
        "monthly_income_goal": user.get("monthly_income_goal", 0),
        "budget_warning_threshold": user.get("budget_warning_threshold", 80),
        "default_wallet": user.get("default_wallet", "Default"),
        "ai_tone": user.get("ai_tone", "Professional"),
        "has_onboarded": user.get("has_onboarded", False),
        "notifications_enabled": user.get("notifications_enabled", True),
        "email_alerts_enabled": user.get("email_alerts_enabled", True),
        "weekly_summaries_enabled": user.get("weekly_summaries_enabled", True),
        "budget_warnings_enabled": user.get("budget_warnings_enabled", True),
    }
    token = create_access_token(identity=str(user["_id"]), additional_claims=claims)
    response, status = ok({"user": user_payload(user)}, message)
    set_access_cookies(response, token)
    return response, status


@auth_bp.post("/register")
def register():
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    email = normalize_email(payload.get("email"))
    password = payload.get("password", "")
    confirm_password = payload.get("confirm_password", "")
    
    errors = password_errors(password)
    if not name:
        errors.append("Name is required.")
    if not email:
        errors.append("Valid email is required.")
    if password != confirm_password:
        errors.append("Passwords do not match.")
    if errors:
        return fail("Validation failed.", 422, errors)
    if users().find_one({"email": email}):
        return fail("Account already exists.", 409)

    role = "admin" if email == current_app.config["ADMIN_EMAIL"] else "user"
    otp_code = f"{secrets.randbelow(900000) + 100000:06d}"
    doc = {
        "name": name,
        "email": email,
        "password_hash": bcrypt.generate_password_hash(password).decode("utf-8"),
        "role": role,
        "avatar": "sunset",
        "profession": "Salaried",
        "currency": "₹",
        "risk_profile": "Moderate",
        "monthly_income_goal": 0,
        "verified": False,
        "otp": otp_code,
        "otp_created_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    users().insert_one(doc)
    
    # Send verification email via SMTP in real time
    send_otp_email(email, otp_code)
    
    return ok({"email": email, "role": role, "verified": False}, "Account created. A verification OTP has been sent to your email.", 201)


@auth_bp.post("/login")
def login():
    payload = request.get_json() or {}
    email = normalize_email(payload.get("email"))
    user = users().find_one({"email": email}) if email else None
    if not user or not bcrypt.check_password_hash(user["password_hash"], payload.get("password", "")):
        return fail("Invalid email or password.", 401)
    if user.get("status") == "suspended":
        return fail("Your account has been suspended.", 403)
    if user.get("verified") is False:
        return fail("Account email not verified. Please verify your email.", 403, {"email": user["email"], "verified": False})

    claims = {
        "email": user["email"],
        "name": user["name"],
        "avatar": user.get("avatar", "sunset"),
        "is_admin": user.get("role") == "admin",
        "profession": user.get("profession", "Salaried"),
        "currency": user.get("currency", "₹"),
        "risk_profile": user.get("risk_profile", "Moderate"),
        "monthly_income_goal": user.get("monthly_income_goal", 0),
        "has_onboarded": user.get("has_onboarded", False),
    }
    token = create_access_token(identity=str(user["_id"]), additional_claims=claims)
    response, status = ok({"user": user_payload(user)}, "Logged in.")
    set_access_cookies(response, token)
    return response, status


@auth_bp.post("/admin/login")
def admin_login():
    payload = request.get_json() or {}
    email = normalize_email(payload.get("email"))
    user = users().find_one({"email": email}) if email else None
    if not user or not bcrypt.check_password_hash(user["password_hash"], payload.get("password", "")):
        return fail("Invalid admin credentials.", 401)
    if user.get("status") == "suspended":
        return fail("Your account has been suspended.", 403)
    if user.get("role") != "admin" and user["email"] != current_app.config["ADMIN_EMAIL"]:
        return fail("Admin access required.", 403)

    claims = {"email": user["email"], "name": user["name"], "avatar": user.get("avatar", "sunset"), "is_admin": True}
    token = create_access_token(identity=str(user["_id"]), additional_claims=claims)
    response, status = ok({"user": user_payload({**user, "role": "admin"})}, "Admin logged in.")
    set_access_cookies(response, token)
    return response, status


@auth_bp.get("/me")
@jwt_required()
def me():
    user = users().find_one({"_id": get_jwt_identity()})
    if not user:
        return fail("User not found.", 404)
    return ok({"user": user_payload(user)})


@auth_bp.put("/me")
@jwt_required()
def update_me():
    user = users().find_one({"_id": get_jwt_identity()})
    if not user:
        return fail("User not found.", 404)
    payload = request.get_json() or {}
    update = {"updated_at": datetime.now(timezone.utc)}
    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            return fail("Name is required.", 422)
        update["name"] = name
    if "avatar" in payload:
        avatar = (payload.get("avatar") or "").strip()
        if avatar not in AVATAR_THEMES:
            return fail("Invalid avatar.", 422)
        update["avatar"] = avatar
    if "profession" in payload:
        update["profession"] = (payload.get("profession") or "Salaried").strip()
    if "currency" in payload:
        update["currency"] = (payload.get("currency") or "₹").strip()
    if "risk_profile" in payload:
        update["risk_profile"] = (payload.get("risk_profile") or "Moderate").strip()
    if "monthly_income_goal" in payload:
        try:
            update["monthly_income_goal"] = float(payload.get("monthly_income_goal") or 0)
        except ValueError:
            pass
    if "budget_warning_threshold" in payload:
        try:
            update["budget_warning_threshold"] = int(payload.get("budget_warning_threshold") or 80)
        except ValueError:
            pass
    if "default_wallet" in payload:
        update["default_wallet"] = (payload.get("default_wallet") or "Default").strip()
    if "ai_tone" in payload:
        update["ai_tone"] = (payload.get("ai_tone") or "Professional").strip()
    if "goals" in payload:
        update["goals"] = payload.get("goals")
    if "custom_goal" in payload:
        update["custom_goal"] = (payload.get("custom_goal") or "").strip()
    if "referral_source" in payload:
        update["referral_source"] = (payload.get("referral_source") or "").strip()
    if "has_onboarded" in payload:
        update["has_onboarded"] = bool(payload.get("has_onboarded"))
    if "notifications_enabled" in payload:
        update["notifications_enabled"] = bool(payload.get("notifications_enabled"))
    if "email_alerts_enabled" in payload:
        update["email_alerts_enabled"] = bool(payload.get("email_alerts_enabled"))
    if "weekly_summaries_enabled" in payload:
        update["weekly_summaries_enabled"] = bool(payload.get("weekly_summaries_enabled"))
    if "budget_warnings_enabled" in payload:
        update["budget_warnings_enabled"] = bool(payload.get("budget_warnings_enabled"))

    users().update_one({"_id": user["_id"]}, {"$set": update})
    user.update(update)
    return issue_user_cookie(user)


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    user = users().find_one({"_id": get_jwt_identity()})
    if not user:
        return fail("User not found.", 404)
    payload = request.get_json() or {}
    new_password = payload.get("new_password", "")
    
    # Verify current password only if it is provided (modal form passes it, inline form does not)
    if "current_password" in payload:
        current_password = payload.get("current_password", "")
        if not bcrypt.check_password_hash(user["password_hash"], current_password):
            return fail("Current password is incorrect.", 400)
        
    errors = password_errors(new_password)
    if errors:
        return fail("Validation failed.", 422, errors)
        
    users().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": bcrypt.generate_password_hash(new_password).decode("utf-8"),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return ok({}, "Password updated successfully.")



@auth_bp.post("/logout")
def logout():
    response, status = ok({}, "Logged out.")
    unset_jwt_cookies(response)
    return response, status


@auth_bp.post("/password/reset-request")
def reset_request():
    payload = request.get_json() or {}
    email = normalize_email(payload.get("email"))
    
    user = users().find_one({"email": email}) if email else None
    if not user:
        return ok({}, "If your email is registered, you will receive a password reset link.")
        
    token = secrets.token_urlsafe(32)
    users().update_one({"_id": user["_id"]}, {"$set": {"reset_token": token, "reset_requested_at": datetime.now(timezone.utc)}})
    
    # Construct the reset link URL
    reset_url = f"{request.host_url.rstrip('/')}/password/reset?token={token}"
    
    # Send reset link email in real time
    send_reset_password_email(email, reset_url)
    
    return ok({"dev_reset_token": token, "reset_url": reset_url}, "If your email is registered, you will receive a password reset link.")



@auth_bp.post("/password/reset")
def reset_password():
    payload = request.get_json() or {}
    errors = password_errors(payload.get("password", ""))
    if errors:
        return fail("Validation failed.", 422, errors)
    user = users().find_one({"reset_token": payload.get("token")})
    if not user:
        return fail("Invalid reset token.", 400)
    users().update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": bcrypt.generate_password_hash(payload["password"]).decode("utf-8")}, "$unset": {"reset_token": "", "reset_requested_at": ""}},
    )
    return ok({}, "Password reset successful.")


@auth_bp.post("/verify-otp")
def verify_otp():
    payload = request.get_json() or {}
    email = normalize_email(payload.get("email"))
    otp = (payload.get("otp") or "").strip()
    
    if not email or not otp:
        return fail("Email and OTP code are required.", 422)
        
    user = users().find_one({"email": email})
    if not user:
        return fail("User not found.", 404)
        
    if user.get("verified") is True:
        return fail("Account is already verified.", 400)
        
    db_otp = user.get("otp")
    otp_created_at = user.get("otp_created_at")
    
    if not db_otp or not otp_created_at:
        return fail("No OTP generated for this account. Please request a new one.", 400)
        
    # Check if expired
    expiry_limit = timedelta(minutes=current_app.config.get("OTP_EXPIRY_MINUTES", 10))
    if otp_created_at.tzinfo is None:
        otp_created_at = otp_created_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    if now - otp_created_at > expiry_limit:
        return fail("OTP code has expired. Please request a new one.", 400)
        
    if db_otp != otp:
        return fail("Invalid verification code. Please try again.", 400)
        
    # Mark user as verified
    users().update_one(
        {"_id": user["_id"]},
        {"$set": {"verified": True, "updated_at": datetime.now(timezone.utc)}, "$unset": {"otp": "", "otp_created_at": ""}}
    )
    
    # Update user object for issue_user_cookie
    user["verified"] = True
    user.pop("otp", None)
    user.pop("otp_created_at", None)
    
    # Auto log-in on successful verification
    return issue_user_cookie(user, message="Email verified successfully.")


@auth_bp.post("/resend-otp")
def resend_otp():
    payload = request.get_json() or {}
    email = normalize_email(payload.get("email"))
    
    if not email:
        return fail("Email is required.", 422)
        
    user = users().find_one({"email": email})
    if not user:
        return fail("User not found.", 404)
        
    if user.get("verified") is True:
        return fail("Account is already verified.", 400)
        
    # Generate new OTP code
    otp_code = f"{secrets.randbelow(900000) + 100000:06d}"
    
    users().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "otp": otp_code,
            "otp_created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    send_otp_email(email, otp_code)
    return ok({}, "Verification code resent successfully.")


@auth_bp.delete("/delete-account")
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    user = users().find_one({"_id": user_id})
    if not user:
        return fail("User not found.", 404)
        
    # Recursive deletion to maintain database integrity
    from app.models.collections import transactions, budgets, goals, categories, notifications, investments, financial_insights
    users().delete_one({"_id": user_id})
    transactions().delete_many({"user_id": user_id})
    budgets().delete_many({"user_id": user_id})
    goals().delete_many({"user_id": user_id})
    categories().delete_many({"user_id": user_id})
    notifications().delete_many({"user_id": user_id})
    investments().delete_many({"user_id": user_id})
    financial_insights().delete_many({"user_id": user_id})
    
    response, status = ok({}, "Account deleted successfully.")
    unset_jwt_cookies(response)
    return response, status

