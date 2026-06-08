from app.extensions import database


def users():
    return database.db.users


def transactions():
    return database.db.transactions


def budgets():
    return database.db.budgets


def goals():
    return database.db.savings_goals


def notifications():
    return database.db.notifications


def financial_insights():
    return database.db.financial_insights


def investments():
    return database.db.investments


def categories():
    return database.db.categories

