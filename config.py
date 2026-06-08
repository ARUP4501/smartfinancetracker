import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-use-env-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-use-env-in-production")
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    SQLITE_DATABASE = os.getenv("SQLITE_DATABASE", "finance.sqlite3")
    APP_NAME = os.getenv("APP_NAME", "Smart Financial Management System")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@smartfinance.local").lower()
