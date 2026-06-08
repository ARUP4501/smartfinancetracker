from flask import Flask, request, render_template
from sqlite3 import Error as SQLiteError

from config import Config
from app.extensions import bcrypt, database, jwt
from app.utils.responses import fail


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    database.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from app.routes.web import web_bp
    from app.routes.auth import auth_bp
    from app.routes.transactions import transactions_bp
    from app.routes.budgets import budgets_bp
    from app.routes.goals import goals_bp
    from app.routes.analytics import analytics_bp
    from app.routes.notifications import notifications_bp
    from app.routes.reports import reports_bp
    from app.routes.admin import admin_bp
    from app.routes.investments import investments_bp
    from app.routes.categories import categories_bp

    app.register_blueprint(web_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(budgets_bp, url_prefix="/api/budgets")
    app.register_blueprint(goals_bp, url_prefix="/api/goals")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(investments_bp, url_prefix="/api/investments")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")

    @app.before_request
    def check_maintenance():
        # Bypass checks for static files and admin operations
        if (
            request.path.startswith("/admin")
            or request.path.startswith("/api/admin")
            or request.path.startswith("/api/auth/admin")
            or request.path.startswith("/static")
            or request.path == "/favicon.ico"
        ):
            return

        # Fetch maintenance mode status from database
        try:
            settings = database.db.system_settings.find_one({"_id": "maintenance_mode"})
            if settings and settings.get("enabled"):
                # Return JSON if it's an API call, else HTML
                if request.path.startswith("/api/"):
                    return fail("System is undergoing scheduled maintenance.", 503)
                return render_template("maintenance.html"), 503
        except Exception:
            pass

    @app.errorhandler(SQLiteError)
    def database_error(_error):
        return fail("Database request failed.", 500)

    @app.after_request
    def add_header(response):
        # Prevent browser caching of templates during development
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "-1"
        return response

    return app
