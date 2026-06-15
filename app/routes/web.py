from flask import Blueprint, redirect, render_template, url_for
from flask_jwt_extended import get_jwt, verify_jwt_in_request

from app.services.finance import dashboard_summary

web_bp = Blueprint("web", __name__)


def protected_page(template, **context):
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return redirect(url_for("web.login_page"))
    if not claims.get("has_onboarded"):
        return redirect(url_for("web.onboarding_page"))
    return render_template(template, claims=claims, **context)


def admin_page(template, **context):
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return redirect(url_for("web.admin_login_page"))
    if not claims.get("is_admin"):
        return redirect(url_for("web.admin_login_page"))
    return render_template(template, claims=claims, **context)


@web_bp.get("/")
def landing():
    return render_template("landing.html")


@web_bp.get("/login")
def login_page():
    return render_template("auth/login.html")


@web_bp.get("/register")
def register_page():
    return render_template("auth/register.html")


@web_bp.get("/verify-otp")
def verify_otp_page():
    return render_template("auth/verify_otp.html")


@web_bp.get("/password/reset")
def reset_password_page():
    return render_template("auth/reset_password.html")


@web_bp.get("/password/reset-requested")
def reset_requested_page():
    return render_template("auth/reset_requested.html")





@web_bp.get("/onboarding")
def onboarding_page():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return redirect(url_for("web.login_page"))
    if claims.get("has_onboarded"):
        return redirect(url_for("web.dashboard"))
    return render_template("pages/onboarding.html", claims=claims)


@web_bp.get("/dashboard")
def dashboard():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return redirect(url_for("web.login_page"))
    if not claims.get("has_onboarded"):
        return redirect(url_for("web.onboarding_page"))
    
    from flask_jwt_extended import get_jwt_identity
    user_id = get_jwt_identity()
    return render_template(
        "pages/dashboard.html",
        summary=dashboard_summary(user_id),
        claims=claims
    )


@web_bp.get("/transactions")
def transactions_page():
    return protected_page("pages/transactions.html")


@web_bp.get("/budgets")
def budgets_page():
    return protected_page("pages/budgets.html")


@web_bp.get("/goals")
def goals_page():
    return protected_page("pages/goals.html")


@web_bp.get("/investments")
def investments_page():
    return protected_page("pages/investments.html")


@web_bp.get("/analytics")
def analytics_page():
    return protected_page("pages/analytics.html")


@web_bp.get("/reports")
def reports_page():
    return protected_page("pages/reports.html")


@web_bp.get("/insights")
def insights_page():
    return protected_page("pages/insights.html")


@web_bp.get("/settings")
def settings_page():
    return protected_page("pages/settings.html")


@web_bp.get("/chat")
def chat_page():
    return protected_page("pages/chat.html")


@web_bp.get("/admin")
def admin_home():
    try:
        verify_jwt_in_request()
        if get_jwt().get("is_admin"):
            return redirect(url_for("web.admin_dashboard"))
    except Exception:
        pass
    return redirect(url_for("web.admin_login_page"))


@web_bp.get("/admin/login")
def admin_login_page():
    return render_template("admin/login.html")


@web_bp.get("/admin/dashboard")
def admin_dashboard():
    return admin_page("admin/dashboard.html")


@web_bp.get("/admin/users")
def admin_users():
    return admin_page("admin/users.html")


@web_bp.get("/admin/transactions")
def admin_transactions():
    return admin_page("admin/transactions.html")


@web_bp.get("/admin/reports")
def admin_reports():
    return admin_page("admin/reports.html")
