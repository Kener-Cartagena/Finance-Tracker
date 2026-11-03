# 💰 Finance Tracker — Backend

> Production-quality Personal Finance Management API built with **Python · Django · Django REST Framework · MySQL**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Setup & Installation](#3-setup--installation)
4. [Environment Variables](#4-environment-variables)
5. [Running the Server](#5-running-the-server)
6. [Full API Reference](#6-full-api-reference)
7. [Design Decisions](#7-design-decisions)
8. [Scaling & Future Features](#8-scaling--future-features)

---

## 1. Architecture Overview

### Guiding Principles

| Principle | How it's applied |
|-----------|-----------------|
| **Single Responsibility** | Every file has exactly one job: model = data shape, serializer = validation/representation, view = HTTP handling, service = business logic |
| **Security by default** | All endpoints require JWT authentication; every queryset is scoped to `request.user` |
| **Financial precision** | All monetary values use `DecimalField`, never `FloatField` |
| **Scalability** | Composite DB indexes on `(user, date)`, pagination on all list endpoints, service layer ready for async tasks |
| **Frontend-ready** | Every list endpoint supports filtering, ordering, and search; statistics endpoints return data in Chart.js-compatible shapes |

### Layer Diagram

```
HTTP Request
    ↓
urls.py           ← routes to the right view
    ↓
views.py          ← authentication, HTTP verbs, calling serializers/services
    ↓
serializers.py    ← input validation, output representation
    ↓
services.py       ← business logic (goals), aggregation queries (dashboard)
    ↓
models.py         ← data structure only
    ↓
MySQL Database
```

---

## 2. Project Structure

```
finance_tracker/
│
├── manage.py
├── requirements.txt
├── .env.example                   ← copy to .env and fill in your values
│
├── config/
│   ├── settings.py                ← all settings, reads from .env
│   ├── urls.py                    ← root URL router
│   ├── pagination.py              ← shared pagination class (20/page, max 100)
│   └── wsgi.py
│
└── apps/
    ├── users/                     ← custom User model + JWT auth
    │   ├── models.py              ← User (email login)
    │   ├── managers.py            ← create_user / create_superuser
    │   ├── serializers.py         ← Register, Profile, ChangePassword
    │   ├── views.py               ← Register, Me, ChangePassword, Logout
    │   └── urls.py
    │
    ├── incomes/                   ← income CRUD
    │   ├── models.py
    │   ├── serializers.py
    │   ├── filters.py             ← date range + source search
    │   └── views.py
    │
    ├── expenses/                  ← expense CRUD with categories
    │   ├── models.py              ← ExpenseCategory TextChoices
    │   ├── serializers.py
    │   ├── filters.py
    │   └── views.py               ← includes GET /categories/ action
    │
    ├── goals/                     ← financial goals + contributions
    │   ├── models.py              ← Goal + GoalContribution
    │   ├── services.py            ← GoalContributionService (atomic updates)
    │   ├── serializers.py
    │   └── views.py               ← includes POST /contribute/ action
    │
    ├── investments/               ← investment tracking
    │   ├── models.py              ← InvestmentType TextChoices
    │   ├── serializers.py
    │   └── views.py
    │
    └── dashboard/                 ← aggregation + statistics (read-only)
        ├── services.py            ← ALL aggregation queries live here
        ├── views.py               ← thin views, delegate to services
        └── urls.py
```

---

## 3. Setup & Installation

### Prerequisites
- Python 3.11+
- MySQL 8.0+
- pip / virtualenv

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/yourname/finance-tracker.git
cd finance-tracker

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create MySQL database
mysql -u root -p
CREATE DATABASE finance_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 5. Configure environment
cp .env.example .env
# Edit .env with your DB credentials and secret key

# 6. Run migrations
python manage.py migrate

# 7. Create superuser (optional)
python manage.py createsuperuser
```

---

## 4. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | — | Django secret key |
| `DEBUG` | ✅ | `False` | Set `True` in development |
| `ALLOWED_HOSTS` | ✅ | `localhost` | Comma-separated hostnames |
| `DB_NAME` | ✅ | — | MySQL database name |
| `DB_USER` | ✅ | — | MySQL username |
| `DB_PASSWORD` | ✅ | — | MySQL password |
| `DB_HOST` | ✅ | `localhost` | MySQL host |
| `DB_PORT` | ✅ | `3306` | MySQL port |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | — | `60` | JWT access token TTL |
| `REFRESH_TOKEN_LIFETIME_DAYS` | — | `7` | JWT refresh token TTL |
| `CORS_ALLOWED_ORIGINS` | — | `http://localhost:3000` | Frontend origins |

---

## 5. Running the Server

```bash
# Development
python manage.py runserver

# Production (gunicorn)
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4

# API docs (Swagger UI)
http://localhost:8000/api/docs/

# Django Admin
http://localhost:8000/admin/
```

---

## 6. Full API Reference

### Authentication Header (all protected endpoints)
```
Authorization: Bearer <access_token>
```

---

### 🔐 Authentication  `/api/auth/`

#### `POST /api/auth/register/`
Register a new user. Returns tokens immediately.

**Request:**
```json
{
  "email": "user@example.com",
  "first_name": "Ana",
  "last_name": "Lopez",
  "password": "securePass123",
  "password_confirm": "securePass123"
}
```
**Response `201`:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "Ana",
    "last_name": "Lopez",
    "full_name": "Ana Lopez",
    "currency": "USD",
    "date_joined": "2024-06-01T10:00:00Z"
  },
  "tokens": {
    "refresh": "eyJ...",
    "access": "eyJ..."
  }
}
```

---

#### `POST /api/auth/login/`
**Request:**
```json
{ "email": "user@example.com", "password": "securePass123" }
```
**Response `200`:**
```json
{ "access": "eyJ...", "refresh": "eyJ..." }
```

---

#### `POST /api/auth/token/refresh/`
**Request:** `{ "refresh": "eyJ..." }`
**Response:** `{ "access": "eyJ..." }`

---

#### `GET /api/auth/me/`
Returns current user profile.

#### `PATCH /api/auth/me/`
Update `first_name`, `last_name`, `currency`.

#### `POST /api/auth/change-password/`
```json
{ "old_password": "old123", "new_password": "newSecure456" }
```

#### `POST /api/auth/logout/`
```json
{ "refresh": "eyJ..." }
```

---

### 💵 Incomes  `/api/incomes/`

All endpoints scoped to the authenticated user.
Supports: `?date_after=`, `?date_before=`, `?source=`, `?ordering=date`, `?page=`, `?page_size=`

#### `GET /api/incomes/`
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "amount": "3200.00",
      "source": "Salary",
      "date": "2024-06-01",
      "notes": "",
      "created_at": "2024-06-01T09:00:00Z"
    }
  ]
}
```

#### `POST /api/incomes/`
```json
{ "amount": 500.00, "source": "Freelance project", "date": "2024-06-15", "notes": "React dashboard" }
```

#### `GET /api/incomes/{id}/`
#### `PATCH /api/incomes/{id}/`
#### `DELETE /api/incomes/{id}/`

---

### 💸 Expenses  `/api/expenses/`

Supports: `?category=food`, `?date_after=`, `?date_before=`, `?description=`, `?ordering=-amount`

#### `GET /api/expenses/`
```json
{
  "count": 5,
  "results": [
    {
      "id": 1,
      "amount": "45.50",
      "category": "food",
      "category_display": "Food",
      "description": "Weekly groceries",
      "date": "2024-06-10",
      "created_at": "2024-06-10T18:00:00Z"
    }
  ]
}
```

#### `POST /api/expenses/`
```json
{ "amount": 45.50, "category": "food", "description": "Weekly groceries", "date": "2024-06-10" }
```

#### `GET /api/expenses/categories/`
Returns all valid categories for UI dropdowns:
```json
[
  { "value": "food", "label": "Food" },
  { "value": "transport", "label": "Transport" },
  ...
]
```

---

### 🎯 Goals  `/api/goals/`

#### `GET /api/goals/`
```json
{
  "results": [
    {
      "id": 1,
      "name": "Emergency Fund",
      "target_amount": "5000.00",
      "current_amount": "1500.00",
      "remaining_amount": "3500.00",
      "progress_percentage": 30.0,
      "deadline": "2024-12-31",
      "is_completed": false,
      "created_at": "2024-01-01T00:00:00Z",
      "contributions": [
        { "id": 1, "amount": "500.00", "note": "January saving", "date": "2024-01-31", "created_at": "..." },
        { "id": 2, "amount": "1000.00", "note": "February saving", "date": "2024-02-29", "created_at": "..." }
      ]
    }
  ]
}
```

#### `POST /api/goals/`
```json
{ "name": "AWS Certification", "target_amount": 300.00, "deadline": "2024-09-01" }
```

#### `POST /api/goals/{id}/contribute/`
Add money toward a goal. Updates progress atomically.

**Request:**
```json
{ "amount": 150.00, "date": "2024-06-15", "note": "Monthly contribution" }
```
**Response `201`:**
```json
{
  "contribution": { "id": 3, "amount": "150.00", "note": "Monthly contribution", "date": "2024-06-15", "created_at": "..." },
  "goal": { "id": 1, "name": "AWS Certification", "current_amount": "150.00", "progress_percentage": 50.0, ... }
}
```

#### `GET /api/goals/{id}/contributions/`
Paginated list of all contributions for a specific goal.

---

### 📈 Investments  `/api/investments/`

Supports: `?investment_type=stocks`, `?platform=`, `?date_after=`, `?date_before=`

#### `GET /api/investments/`
```json
{
  "results": [
    {
      "id": 1,
      "amount": "1000.00",
      "investment_type": "stocks",
      "investment_type_display": "Stocks",
      "platform": "Robinhood",
      "date": "2024-06-01",
      "notes": "AAPL shares",
      "created_at": "2024-06-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/investments/`
```json
{ "amount": 500.00, "investment_type": "crypto", "platform": "Coinbase", "date": "2024-06-15", "notes": "BTC" }
```

#### `GET /api/investments/types/`
```json
[
  { "value": "stocks", "label": "Stocks" },
  { "value": "crypto", "label": "Cryptocurrency" },
  ...
]
```

---

### 📊 Dashboard  `/api/dashboard/`

All endpoints are **GET only** and return pre-aggregated data.

#### `GET /api/dashboard/overview/`
Top-level financial snapshot for the dashboard header card.
```json
{
  "net_balance": "4200.00",
  "total_income_ever": "18000.00",
  "total_expenses_ever": "11800.00",
  "total_invested": "2000.00",
  "income_this_month": "3200.00",
  "expenses_this_month": "1450.00",
  "savings_this_month": "1750.00",
  "month": "June 2024"
}
```

#### `GET /api/dashboard/goals/`
Progress for all goals (for progress bars in UI).
```json
[
  {
    "id": 1,
    "name": "Emergency Fund",
    "target_amount": "5000.00",
    "current_amount": "2000.00",
    "remaining_amount": "3000.00",
    "progress_percentage": 40.0,
    "deadline": "2024-12-31",
    "is_completed": false
  }
]
```

#### `GET /api/dashboard/statistics/expenses-by-category/`
`?year=2024&month=6` (both optional)
Designed for Chart.js **pie/doughnut charts**.
```json
[
  { "category": "food", "label": "Food", "total": "320.00", "count": 12 },
  { "category": "transport", "label": "Transport", "total": "180.00", "count": 8 },
  { "category": "entertainment", "label": "Entertainment", "total": "95.00", "count": 3 }
]
```

#### `GET /api/dashboard/statistics/monthly-summary/`
`?months=6` (default 12)
Designed for Chart.js **bar/line charts**.
```json
[
  { "month": "2024-01", "income": "3000.00", "expenses": "1800.00", "savings": "1200.00" },
  { "month": "2024-02", "income": "3200.00", "expenses": "1950.00", "savings": "1250.00" },
  { "month": "2024-03", "income": "3100.00", "expenses": "2100.00", "savings": "1000.00" }
]
```

#### `GET /api/dashboard/statistics/savings-rate/`
```json
{
  "month": "June 2024",
  "income": "3200.00",
  "expenses": "1450.00",
  "savings": "1750.00",
  "savings_rate_percent": "54.69"
}
```

#### `GET /api/dashboard/statistics/investments/`
Designed for Chart.js **pie/doughnut charts**.
```json
{
  "total_invested": "2500.00",
  "breakdown": [
    { "type": "stocks", "label": "Stocks", "total": "1500.00", "count": 3 },
    { "type": "crypto", "label": "Cryptocurrency", "total": "1000.00", "count": 2 }
  ]
}
```

---

## 7. Design Decisions

### Why a Service Layer for Goals?
The goal contribution operation requires two writes in one atomic block: create the `GoalContribution` row AND update `Goal.current_amount`. If one fails, both must roll back. Django's `@transaction.atomic` + a dedicated service class (`GoalContributionService`) ensures this is always safe and is the single place this logic lives.

### Why DecimalField for money?
`FloatField` has floating-point rounding errors (`0.1 + 0.2 = 0.30000000000000004`). Financial applications must use `Decimal` everywhere.

### Why composite DB indexes on `(user, date)`?
Dashboard queries filter by `user` and then aggregate by `date`. A composite index makes these queries O(log n) instead of a full table scan.

### Why email login instead of username?
Modern users don't remember usernames. Email + password is the standard UX pattern for personal finance apps.

---

## 8. Scaling & Future Features

### Performance Scaling
- Add **Redis caching** for dashboard statistics (they don't need to be real-time).
- Use **Celery + Redis** for async tasks (e.g. sending monthly reports by email).
- Add **database read replicas** for heavy analytics queries.
- Consider **Elasticsearch** if you need full-text search across transactions.

### Feature Roadmap

#### Budgeting Module
Add a `Budget` model with `category`, `monthly_limit`, and `period`.
Create a service that compares actual spending vs budget and computes `remaining_budget_by_category`.
Add an endpoint: `GET /api/budgets/status/` returning budget health per category.

#### Notifications
Use Django signals (`post_save` on `Expense`) to trigger alerts:
- Budget limit exceeded
- Goal completed
- Monthly summary ready
Deliver via email (Django's `send_mail`), push (Firebase), or in-app.

#### Financial Predictions
Using historical monthly averages:
- Predict next month's expenses by category
- Estimate goal completion date based on average contribution rate
- Calculate projected savings rate
Can be built as a pure Python service layer without any ML library initially.

#### Multi-currency Support
Add `currency` and `exchange_rate` fields to Income and Expense.
Store everything in base currency (USD) with a conversion table.
Use an external API (Fixer.io, Open Exchange Rates) for live rates via a Celery task.

#### Export
Add `GET /api/export/csv/` and `GET /api/export/pdf/` endpoints using
`django-import-export` or `reportlab`.

### Security Hardening for Production
- Enable `djangorestframework-simplejwt` token blacklisting
- Add `django-axes` for brute-force protection
- Set `SECURE_SSL_REDIRECT=True`, `HSTS` headers
- Use `whitenoise` or a CDN for static files
- Rate-limit sensitive endpoints with `django-ratelimit`
