# Smart Financial Management System

A production-style Flask and SQLite full-stack personal finance platform with automated transaction tracking, budget analytics, savings goals, rule-based AI insights, notifications, reports, and an admin panel.

## Tech Stack

- Backend: Python 3, Flask, Flask Blueprints, Flask JWT Extended, Flask Bcrypt
- Database: SQLite with a lightweight document-store adapter
- Frontend: HTML5, CSS3, Bootstrap 5, JavaScript ES6, Fetch API, Chart.js
- Architecture: MVC-style routes, services, reusable templates, modular static assets

## Features

- Authentication with registration, login, logout, password reset token flow, strong password validation, duplicate email prevention, bcrypt hashing, and JWT cookie sessions.
- Dashboard with balance, income, expenses, monthly savings, budget usage, recent transactions, notifications, and insights.
- Income and expense CRUD with finance categories.
- Smart transaction parser for messages like `Rs. 5000 credited to your account` and `Rs. 850 debited from your account`.
- Monthly and category-wise budgets with 80%, 90%, 100%, and exceeded usage indicators.
- Transaction history with search, sorting-ready API, filters, and pagination.
- Savings goal tracker with progress bars and goal-achieved notifications.
- Financial analytics with six Chart.js charts.
- Rule-based AI insights for spending changes, discretionary savings, and savings rate.
- Reports preview and PDF/Excel export.
- Admin summary for total users, transactions, tracked volume, and user analytics.

## Project Structure

```text
app/
  routes/          Flask Blueprints for web pages and REST APIs
  services/        Finance, analytics, parser, reports, notifications, insights
  models/          SQLite-backed collection helpers
  templates/       Jinja2 frontend pages
  static/          CSS, JavaScript, generated image assets
config.py          Environment-driven configuration
run.py             Local Flask entry point
docs/              API and deployment documentation
```

## Setup

1. Create and activate a virtual environment.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies.

```powershell
pip install -r requirements.txt
```

3. Copy environment settings.

```powershell
Copy-Item .env.example .env
```

4. Run the application. SQLite creates `instance/finance.sqlite3` automatically.

```powershell
python run.py
```

Open `http://127.0.0.1:5000`.

## Admin Access

Set `ADMIN_EMAIL` in `.env`, then register using that email. That account receives admin privileges automatically.

Admin portal URLs:

- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/transactions`
- `/admin/reports`

The admin portal is separate from the normal user dashboard and requires admin credentials through `/api/auth/admin/login`.

## Cognifyz Internship Mapping

- Task 1: HTML forms, Flask server, Jinja2 rendering
- Task 2: Client validation and server validation
- Task 3: Advanced CSS, Bootstrap, responsive design
- Task 4: DOM manipulation, dynamic updates, password strength checker
- Task 5: REST APIs and CRUD operations
- Task 6: SQLite database integration, authentication, authorization

## Notes

The password reset endpoint returns a development reset token in the API response. In production, send that token through a verified email service instead.
