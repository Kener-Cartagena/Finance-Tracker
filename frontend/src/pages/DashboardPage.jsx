/**
 * DashboardPage — the main financial overview page.
 * Loads data from multiple dashboard endpoints in parallel.
 */

import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, LineChart } from 'lucide-react'
import dashboardService from '../services/dashboardService'
import StatCard from '../components/ui/StatCard'
import { PageSpinner } from '../components/ui/Spinner'
import ExpensePieChart from '../components/charts/ExpensePieChart'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import InvestmentDonut from '../components/charts/InvestmentDonut'
import { formatCurrency, formatPercent, formatDate } from '../utils/format'
import { CategoryBadge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import incomeService from '../services/incomeService'
import expenseService from '../services/expenseService'

export default function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [goals, setGoals] = useState([])
  const [expensesByCategory, setExpensesByCategory] = useState([])
  const [monthlySummary, setMonthlySummary] = useState([])
  const [investmentsSummary, setInvestmentsSummary] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, g, ec, ms, inv, inc, exp] = await Promise.all([
          dashboardService.getOverview(),
          dashboardService.getGoalsSummary(),
          dashboardService.getExpensesByCategory(),
          dashboardService.getMonthlySummary(6),
          dashboardService.getInvestmentsSummary(),
          incomeService.list({ page_size: 5 }),
          expenseService.list({ page_size: 5 }),
        ])
        setOverview(ov)
        setGoals(g)
        setExpensesByCategory(ec)
        setMonthlySummary(ms)
        setInvestmentsSummary(inv)

        // Merge and sort recent transactions
        const incomes  = (inc.results || []).map(r => ({ ...r, kind: 'income' }))
        const expenses = (exp.results || []).map(r => ({ ...r, kind: 'expense' }))
        const merged   = [...incomes, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
        setRecentTransactions(merged)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display text-white">
          Good {getGreeting()}, {user?.first_name || 'there'} 👋
        </h1>
        <p className="text-obsidian-400 text-sm mt-1">{overview?.month} · Financial Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Net Balance"
          value={formatCurrency(overview?.net_balance)}
          subtitle="All time"
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Total Income"
          value={formatCurrency(overview?.income_this_month)}
          subtitle={overview?.month}
          icon={TrendingUp}
          color="sky"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(overview?.expenses_this_month)}
          subtitle={overview?.month}
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Total Invested"
          value={formatCurrency(overview?.total_invested)}
          subtitle="All time"
          icon={LineChart}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="section-title mb-4">Income vs Expenses</h2>
          <MonthlyBarChart data={monthlySummary} />
        </div>
        <div className="card p-6">
          <h2 className="section-title mb-4">Expenses by Category</h2>
          <ExpensePieChart data={expensesByCategory} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="section-title mb-4">Recent Transactions</h2>
          {recentTransactions.length === 0
            ? <p className="text-obsidian-500 text-sm">No transactions yet.</p>
            : (
              <div className="space-y-1">
                {recentTransactions.map((t) => (
                  <div key={`${t.kind}-${t.id}`}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl table-row-hover">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        t.kind === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                      }`}>
                        {t.kind === 'income'
                          ? <TrendingUp size={14} className="text-emerald-400" />
                          : <TrendingDown size={14} className="text-rose-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-obsidian-200 truncate">
                          {t.source || t.description || t.category}
                        </p>
                        <p className="text-xs text-obsidian-500">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`font-numeric text-sm font-medium flex-shrink-0 ml-4 ${
                      t.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {t.kind === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Goals + Investments */}
        <div className="space-y-6">
          {/* Investments mini */}
          <div className="card p-5">
            <h2 className="section-title mb-1">Investments</h2>
            <p className="text-xs text-obsidian-400 mb-3">
              Total: <span className="font-numeric text-sky-400">
                {formatCurrency(investmentsSummary?.total_invested)}
              </span>
            </p>
            <InvestmentDonut data={investmentsSummary?.breakdown || []} />
            {(investmentsSummary?.breakdown || []).map((b) => (
              <div key={b.type} className="flex justify-between text-xs mt-2">
                <span className="text-obsidian-400">{b.label}</span>
                <span className="font-numeric text-obsidian-200">{formatCurrency(b.total)}</span>
              </div>
            ))}
          </div>

          {/* Savings rate */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Monthly Savings</h2>
            <div className="text-3xl font-display text-emerald-400 mb-1">
              {formatCurrency(overview?.savings_this_month)}
            </div>
            <p className="text-xs text-obsidian-400">{overview?.month}</p>
          </div>
        </div>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="card p-6">
          <h2 className="section-title mb-5">Goal Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <GoalProgressCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GoalProgressCard({ goal }) {
  const pct = Math.min(goal.progress_percentage, 100)
  return (
    <div className="bg-obsidian-800/50 border border-white/[0.06] rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <p className="text-sm font-medium text-obsidian-200 leading-snug">{goal.name}</p>
        <span className={`text-xs font-numeric ml-2 flex-shrink-0 ${
          goal.is_completed ? 'text-emerald-400' : 'text-obsidian-400'
        }`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-obsidian-700 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-obsidian-500">
        <span className="font-numeric">{formatCurrency(goal.current_amount)}</span>
        <span className="font-numeric">{formatCurrency(goal.target_amount)}</span>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
