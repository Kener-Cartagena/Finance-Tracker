# 💰 Ledger — Finance Tracker Frontend

> Modern fintech dashboard built with **React · Vite · TailwindCSS · Recharts**

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI library |
| Vite | Build tool / dev server |
| TailwindCSS | Utility-first styling |
| Recharts | Charts (pie, bar, line) |
| Axios | HTTP client with JWT interceptors |
| React Router v6 | Client-side routing |
| Lucide React | Icons |
| DayJS | Date formatting |

---

## Project Structure

```
src/
├── App.jsx                    ← root router
├── main.jsx                   ← entry point
├── index.css                  ← global styles + Tailwind layers
│
├── context/
│   └── AuthContext.jsx        ← global auth state + hooks
│
├── services/                  ← all API logic (Axios calls)
│   ├── api.js                 ← axios instance + JWT auto-refresh
│   ├── authService.js
│   ├── incomeService.js
│   ├── expenseService.js
│   ├── goalService.js
│   ├── investmentService.js
│   └── dashboardService.js
│
├── hooks/
│   └── useApi.js              ← generic async fetching hook
│
├── utils/
│   └── format.js              ← currency, date, color utilities
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx      ← protected route wrapper + sidebar
│   │   ├── Sidebar.jsx        ← navigation sidebar
│   │   └── PageHeader.jsx     ← reusable page title + action
│   │
│   ├── ui/                    ← reusable UI primitives
│   │   ├── StatCard.jsx
│   │   ├── Button.jsx
│   │   ├── Input.jsx          ← Input, Select, Textarea
│   │   ├── Modal.jsx
│   │   ├── Badge.jsx          ← Badge, CategoryBadge
│   │   ├── EmptyState.jsx
│   │   └── Spinner.jsx
│   │
│   └── charts/
│       ├── ExpensePieChart.jsx
│       ├── MonthlyBarChart.jsx
│       └── InvestmentDonut.jsx
│
└── pages/
    ├── LoginPage.jsx
    ├── RegisterPage.jsx
    ├── DashboardPage.jsx      ← main overview
    ├── IncomesPage.jsx
    ├── ExpensesPage.jsx
    ├── GoalsPage.jsx
    └── InvestmentsPage.jsx
```

---

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# .env already points to http://localhost:8000 by default

# 3. Make sure the Django backend is running on port 8000

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

## Production Build

```bash
npm run build
# Output in /dist — serve with nginx or any static host
```

---

## Design System

The UI uses a dark **obsidian** theme with **emerald green** as the primary accent, inspired by modern fintech platforms.

| Token | Value | Usage |
|-------|-------|-------|
| `obsidian-950` | `#08080f` | Page background |
| `obsidian-900` | `#0f0f18` | Card background |
| `emerald-500` | `#10b981` | Primary accent, income |
| `rose-500` | `#f43f5e` | Danger, expenses |
| `sky-500` | `#0ea5e9` | Investments |
| `amber-500` | `#f59e0b` | Warnings |

**Fonts:**
- Display: *DM Serif Display* (headings)
- Body: *DM Sans* (UI text)
- Numbers: *JetBrains Mono* (currency amounts)
