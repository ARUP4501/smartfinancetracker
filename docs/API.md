# API Documentation

All protected APIs use JWT cookies created by `/api/auth/login`.

## Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create user account |
| POST | `/api/auth/login` | Login and set JWT cookie |
| POST | `/api/auth/logout` | Clear JWT cookie |
| POST | `/api/auth/password/reset-request` | Generate development reset token |
| POST | `/api/auth/password/reset` | Reset password using token |

## Transactions

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/transactions/` | Paginated transaction history |
| POST | `/api/transactions/` | Add income or expense |
| PUT | `/api/transactions/<id>` | Edit transaction |
| DELETE | `/api/transactions/<id>` | Delete transaction |
| POST | `/api/transactions/parse` | Parse bank/SMS message and create transaction |

Query filters: `page`, `limit`, `type`, `category`, `search`, `sort`.

## Budgets

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/budgets/` | List budgets with usage |
| POST | `/api/budgets/` | Create budget |
| PUT | `/api/budgets/<id>` | Update budget |
| DELETE | `/api/budgets/<id>` | Delete budget |

## Savings Goals

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/goals/` | List goals |
| POST | `/api/goals/` | Create goal |
| PUT | `/api/goals/<id>` | Update goal |
| DELETE | `/api/goals/<id>` | Delete goal |

## Analytics and Insights

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/analytics/` | Chart data for six analytics views |
| GET | `/api/analytics/insights` | Generate rule-based AI financial insights |

## Notifications

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/notifications/` | Latest notifications and unread count |
| PUT | `/api/notifications/<id>/read` | Mark notification as read |

## Reports

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/reports/` | Preview report rows |
| GET | `/api/reports/export?format=pdf` | Download PDF |
| GET | `/api/reports/export?format=excel` | Download Excel |

Report filters: `type=income|expense|all`, `year`, `month`.

## Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/summary` | User, transaction, and tracked-volume analytics |
