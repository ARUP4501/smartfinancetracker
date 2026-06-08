from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager

from app.sqlite_store import SQLiteStore

database = SQLiteStore()
bcrypt = Bcrypt()
jwt = JWTManager()
