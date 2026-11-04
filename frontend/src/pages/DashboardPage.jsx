/**
 * DashboardPage — resumen financiero con filtro de fechas.
 * Todos los totales están en lempiras (los dólares se convierten con la tasa de cada registro).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Landmark, Banknote, Smartphone,
  PartyPopper, CalendarClock, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import dashboardService from '../services/dashboardService'
import planningService from '../services/planningService'
import incomeService from '../services/incomeService'
import expenseService from '../services/expenseService'
import StatCard from '../components/ui/StatCard'
import { PageSpinner } from '../components/ui/Spinner'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import ExpensePieChart from '../components/charts/ExpensePieChart'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import InvestmentDonut from '../components/charts/InvestmentDonut'
import { formatCurrency, formatByCurrency, formatDate } from '../utils/format'
import { describeRange, presetRange } from '../utils/dates'
import { useAuth } from '../context/AuthContext'

const KIND_ICONS = { bank: Landmark, wallet: Smartphone, cash: Banknote, other: Wallet }

export default function DashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState(() => ({ preset: 'month', ...presetRange('month') }))
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState(null)
  const [goals, setGoals] = useState([])
  const [expensesByCategory, setExpensesByCategory] = useState([])
  const [monthlySummary, setMonthlySummary] = useState([])
  const [investmentsSummary, setInvestmentsSummary] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [plan, setPlan] = useState(null)

  // Plan + goals don't depend on the filter.
  useEffect(() => {
    planningService.getSummary().then(setPlan).catch(console.error)
    dashboardService.getGoalsSummary().then(setGoals).catch(console.error)
  }, [])

  useEffect(() => {
    // Custom range with only one date filled in: wait for the other one.
    if (range.preset === 'custom' && (!range.date_from || !range.date_to)) return
    const r = { date_from: range.date_from, date_to: range.date_to }
    let cancelled = false
    const load = async () => {
      setRefreshing(true)
      try {
        const listParams = { page_size: 8, date_after: r.date_from || undefined, date_before: r.date_to || undefined }
        const [ov, ec, ms, inv, inc, exp] = await Promise.all([
          dashboardService.getOverview(r),
          dashboardService.getExpensesByCategory(r),
          dashboardService.getMonthlySummary(r, 6),
          dashboardService.getInvestmentsSummary(r),
          incomeService.list(listParams),
          expenseService.list(listParams),
        ])
        if (cancelled) return
        setOverview(ov)
        setExpensesByCategory(ec)
        setMonthlySummary(ms)
        setInvestmentsSummary(inv)
        const incomes  = (inc.results || []).map(x => ({ ...x, kind: 'income' }))
        const expenses = (exp.results || []).map(x => ({ ...x, kind: 'expense' }))
        setRecentTransactions(
          [...incomes, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
        )
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [range.preset, range.date_from, range.date_to])

  if (loading) return <PageSpinner />

  const rangeLabel = describeRange(range)
  const periodWord = { biweekly: 'quincena', monthly: 'mes', weekly: 'semana', custom: 'período' }[plan?.period?.type] || 'período'

  return (
    <div className={clsx('space-y-8 animate-fade-in transition-opacity', refreshing && 'opacity-70')}>
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-display text-white">
            {getGreeting()}, {user?.first_name || 'hola'} 👋
          </h1>
          <p className="text-obsidian-400 text-sm mt-1">{rangeLabel} · Totales en lempiras (tasa actual $1 = L {parseFloat(overview?.exchange_rate || 0).toFixed(2)})</p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos"
          value={formatCurrency(overview?.income)}
          subtitle={formatByCurrency(overview?.income_by_currency)}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Gastos"
          value={formatCurrency(overview?.expenses)}
          subtitle={`${overview?.expense_count ?? 0} gastos · ${formatByCurrency(overview?.expenses_by_currency)}`}
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Ahorro del rango"
          value={formatCurrency(overview?.savings)}
          subtitle={parseFloat(overview?.invested) > 0
            ? `Ingresos − gastos − inversiones (${formatCurrency(overview?.invested)})`
            : 'Ingresos − gastos'}
          icon={PiggyBank}
          color={parseFloat(overview?.savings) < 0 ? 'rose' : 'sky'}
        />
        <StatCard
          title="Dinero en cuentas"
          value={formatCurrency(overview?.accounts_total_hnl)}
          subtitle={formatByCurrency(overview?.accounts_by_currency)}
          icon={Wallet}
          color="amber"
        />
      </div>

      {/* Accounts + plan + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">¿Dónde está mi dinero?</h2>
            <Link to="/accounts" className="text-xs text-emerald-400 hover:text-emerald-300">Cuentas →</Link>
          </div>
          {(overview?.accounts || []).length === 0 ? (
            <p className="text-sm text-obsidian-500">
              Crea tus cuentas (Airtm, Banco Atlántida, Efectivo…) en <Link to="/accounts" className="text-emerald-400">Cuentas</Link>.
            </p>
          ) : (
            <div className="space-y-2">
              {overview.accounts.map(a => {
                const Icon = KIND_ICONS[a.kind] || Wallet
                return (
                  <div key={a.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <Icon size={14} className="text-sky-400" />
                      <span className="text-sm text-obsidian-200">{a.name}</span>
                    </div>
                    <div className="text-right">
                      <span className={clsx('font-numeric text-sm', parseFloat(a.balance) < 0 ? 'text-rose-400' : 'text-obsidian-100')}>
                        {formatCurrency(a.balance, a.currency)}
                      </span>
                      {a.currency === 'USD' && (
                        <span className="block text-[11px] font-numeric text-obsidian-500">≈ {formatCurrency(a.balance_hnl)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between border-t border-white/[0.06] pt-2 mt-2 text-sm">
                <span className="text-obsidian-400">Total</span>
                <span className="font-numeric text-emerald-400">{formatCurrency(overview.accounts_total_hnl)}</span>
              </div>
            </div>
          )}
        </div>

        <Link to="/plan" className="card card-hover p-6 block">
          <div className="flex items-center gap-2 mb-1">
            <PartyPopper size={16} className="text-emerald-400" />
            <h2 className="section-title">Libre esta {periodWord}</h2>
          </div>
          <p className="text-xs text-obsidian-500 mb-4">{plan?.period?.label}</p>
          {plan ? (
            <>
              <p className={clsx('text-3xl font-numeric', parseFloat(plan.fun.remaining) < 0 ? 'text-rose-400' : 'text-emerald-400')}>
                {formatCurrency(plan.fun.remaining)}
              </p>
              <div className="mt-4 space-y-1 text-xs text-obsidian-400">
                <div className="flex justify-between"><span>Ingreso</span><span className="font-numeric">{formatCurrency(plan.income.basis_hnl)}</span></div>
                <div className="flex justify-between"><span>Fijos + ahorro + inversión</span>
                  <span className="font-numeric">− {formatCurrency(parseFloat(plan.totals.fixed_committed) + parseFloat(plan.totals.savings_planned) + parseFloat(plan.totals.investment_committed))}</span></div>
                <div className="flex justify-between"><span>Gastos próximos</span>
                  <span className="font-numeric">− {formatCurrency(parseFloat(plan.totals.upcoming_reserved) + parseFloat(plan.totals.planned_paid))}</span></div>
                <div className="flex justify-between"><span>Ya gastado libre</span><span className="font-numeric">− {formatCurrency(plan.fun.spent)}</span></div>
              </div>
              {plan.period.is_current && parseFloat(plan.fun.per_day) > 0 && (
                <p className="text-xs text-obsidian-500 mt-3">≈ {formatCurrency(plan.fun.per_day)} por día</p>
              )}
            </>
          ) : <p className="text-sm text-obsidian-500">Cargando…</p>}
        </Link>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-amber-400" />
              <h2 className="section-title">Por pagar pronto</h2>
            </div>
            <Link to="/upcoming" className="text-xs text-emerald-400 hover:text-emerald-300">Ver →</Link>
          </div>
          {!plan || plan.upcoming.length === 0 ? (
            <p className="text-sm text-obsidian-500">Nada pendiente en este período.</p>
          ) : (
            <div className="space-y-2">
              {plan.upcoming.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.is_emergency && <AlertTriangle size={12} className="text-rose-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm text-obsidian-200 truncate">{u.name}</p>
                      <p className={clsx('text-xs', u.is_overdue ? 'text-rose-400' : 'text-obsidian-500')}>{formatDate(u.due_date)}</p>
                    </div>
                  </div>
                  <span className="font-numeric text-sm text-amber-400">{formatCurrency(u.amount, u.currency)}</span>
                </div>
              ))}
            </div>
          )}
          {parseFloat(overview?.pending_planned_hnl) > 0 && (
            <p className="text-xs text-obsidian-500 mt-4 border-t border-white/[0.06] pt-3">
              Total pendiente ({overview.pending_planned_count}): <span className="font-numeric text-obsidian-300">{formatCurrency(overview.pending_planned_hnl)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="section-title mb-4">Ingresos vs gastos por mes</h2>
          <MonthlyBarChart data={monthlySummary} />
        </div>
        <div className="card p-6">
          <h2 className="section-title mb-4">Gastos por categoría</h2>
          <ExpensePieChart data={expensesByCategory} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h2 className="section-title mb-4">Movimientos recientes</h2>
          {recentTransactions.length === 0
            ? <p className="text-obsidian-500 text-sm">No hay movimientos en este rango.</p>
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
                          {t.source || t.description || t.category_display}
                        </p>
                        <p className="text-xs text-obsidian-500">
                          {formatDate(t.date)}{t.account_name && <> · {t.account_name}</>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className={`font-numeric text-sm font-medium ${
                        t.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {t.kind === 'income' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                      </span>
                      {t.currency === 'USD' && (
                        <span className="block text-[11px] font-numeric text-obsidian-500">≈ {formatCurrency(t.amount_hnl)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        <div className="card p-5">
          <h2 className="section-title mb-1">Inversiones</h2>
          <p className="text-xs text-obsidian-400 mb-3">
            En el rango: <span className="font-numeric text-sky-400">
              {formatCurrency(investmentsSummary?.total_invested)}
            </span>
            {' '}· Total histórico: <span className="font-numeric">{formatCurrency(overview?.total_invested)}</span>
          </p>
          <InvestmentDonut data={investmentsSummary?.breakdown || []} />
          {(investmentsSummary?.breakdown || []).map((b) => (
            <div key={b.type} className="flex justify-between text-xs mt-2">
              <span className="text-obsidian-400">{b.label}</span>
              <span className="font-numeric text-obsidian-200">{formatCurrency(b.total)}</span>
            </div>
          ))}
          <div className="border-t border-white/[0.06] mt-4 pt-3 text-xs text-obsidian-400 flex justify-between">
            <span>Balance neto histórico</span>
            <span className="font-numeric text-obsidian-200">{formatCurrency(overview?.net_balance)}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="card p-6">
          <h2 className="section-title mb-5">Progreso de metas</h2>
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
  const pct = Math.min(parseFloat(goal.progress_percentage), 100)
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
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}
