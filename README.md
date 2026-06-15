# SmartFinance – Enterprise Personal Finance & Analytics Platform

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.3-green.svg)](https://flask.palletsprojects.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple.svg)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SmartFinance is a production-grade, responsive full-stack financial management application. Designed with a dark-neon aesthetic and adaptive light mode, it helps users track income/expenses, monitor budgets through dynamic overlapping metrics, achieve savings targets, parse text transactions automatically, and download detailed statements in PDF/Excel format.

---

## 🌟 Key Features

### 1. Interactive Financial Dashboard
- **Real-Time KPIs**: Track Total Income, Total Expenses, Net Savings, and Month-over-Month changes.
- **Theme Adaptability**: Dark-neon glowing interface with high-contrast light mode support.
- **Dynamic Charting**: Built-in visual analytics using Chart.js, adapting colors automatically to the chosen theme.

### 2. Transaction Management & Smart Parser
- **CRUD Operations**: Record, edit, and delete transactions categorized by type and industry sectors.
- **Dynamic Text Parser**: Enter natural language or copy-paste SMS text (e.g., *"Rs. 5000 credited to account"* or *"Debited Rs. 450 for Food"*) to auto-populate transaction forms.
- **Real-Time Filters**: Standardized search, sort, and pagination filters.

### 3. Budgeting & Overlapping Limits
- **Duplicate Prevention**: Backend controls prevent redundant budgets for the same category and month.
- **Overlapping Progress Charts**: Spent amounts are rendered centered inside Limit containers for clean visual progress.
- **Centered Validation Toasts**: Error warnings draw screen-centered frosted dialog boxes with tactile "OK" actions.

### 4. Savings Goals & Investments
- **Goal Progress**: Visual tracking metrics showing percentages and completion indicators.
- **Investment Portfolio**: Track returns, performance trends, and dynamic growth ratios.

### 5. Enterprise Admin Portal (RBAC)
- **Role-Based Access Control**: Highly secure portal distinct from user space.
- **System Metrics**: Track global metrics (total active users, global transaction volume, system-wide tracked funds).
- **User Auditing**: Monitor, suspend, or reactivate user accounts.

---

## 📂 Project Architecture

```text
├── app/
│   ├── models/          # SQLite store adapter and data access objects
│   ├── routes/          # Flask Blueprints (API endpoints and Jinja2 controllers)
│   ├── services/        # Business logic (finance computations, PDF/Excel generation, AI Advice)
│   ├── static/          # Shared stylesheets (styles.css), JavaScript modules (app.js), images
│   ├── templates/       # Modular Jinja2 HTML templates
│   └── __init__.py      # App factory instantiation
├── instance/            # Application instance database folder (ignored in git)
├── config.py            # Environment configuration
├── run.py               # Main WSGI entry point
├── requirements.txt     # Pip dependencies list
└── README.md            # System documentation
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, Flask, Flask-JWT-Extended (secure cookie-based sessions), Flask-Bcrypt (password hashing).
- **Database**: SQLite (structured inside document collection patterns via `sqlite_store.py`).
- **Frontend**: HTML5, Vanilla CSS3, Bootstrap 5, Javascript ES6 (Fetch API), Chart.js.

---

## ⚙️ Installation & Local Setup

### 1. Clone & Set Up Environment
```bash
# Clone the repository
git clone https://github.com/<your-username>/finance_project.git
cd finance_project

# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Configuration Variables
Create a `.env` file in the root directory based on the `.env.example` template:
```env
FLASK_ENV=development
SECRET_KEY=enter-a-highly-secure-secret-key
JWT_SECRET_KEY=enter-a-highly-secure-jwt-key
SQLITE_DATABASE=finance.sqlite3
ADMIN_EMAIL=admin@smartfinance.local
```

### 4. Run Application
```bash
python run.py
```
Open `http://127.0.0.1:5000` inside your browser. The SQLite database will be initialized automatically in `/instance/finance.sqlite3`.

---

## 🔒 Administrative Roles & Portal

### Why Include an Admin Portal?
Having an Admin Portal in the README demonstrates security best practices (Role-Based Access Control) and shows that the application can manage scale, moderate content, and inspect user activity at an enterprise level.

### Accessing the Admin Portal:
1. Configure `ADMIN_EMAIL` in the `.env` settings.
2. Sign up on the registration page with that exact email address; the account automatically inherits administrative rights.
3. Access the portal routes:
   - Login: `/admin/login`
   - Dashboard: `/admin/dashboard`
   - User Management: `/admin/users`
   - System Reports: `/admin/reports`

---

## 📄 Notes & Best Practices
- **Security**: Database passwords are encrypted using Bcrypt. JSON Web Tokens (JWT) are stored in secure HTTP-only cookies.
- **Deployment**: For live deployment (e.g., PythonAnywhere or VPS), configure `FLASK_ENV=production` and ensure the `instance/` folder has appropriate write permissions.
