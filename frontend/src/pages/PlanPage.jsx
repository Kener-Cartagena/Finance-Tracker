/**
 * PlanPage — plan de gastos por período (quincena, mes, semana o cada N días).
 *
 * "Esta quincena entró X. Tienes que pagar Y, guardar Z e invertir W.
 *  Puedes gastar V en diversión."
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Settings2, Plus, Pencil, Trash2, PartyPopper, Receipt,
  PiggyBank, LineChart, CalendarClock, AlertTriangle, TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'
import planningService from '../services/planningService'
import expenseService from '../services/expenseService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import { PageSpinner } from '../components/ui/Spinner'
import { CategoryBadge } from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../utils/format'

const SECTIONS = [
  { type: 'fixed',      title: 'Gastos fijos',     icon: Receipt,   color: 'text-rose-400',    hint: 'Universidad, gasolina, internet…' },
  { type: 'savings',    title: 'Ahorro / reserva', icon: PiggyBank, color: 'text-amber-400',   hint: 'Reparaciones, fondo de emergencia…' },
  { type: 'investment', title: 'Inversión',        icon: LineChart, color: 'text-sky-400',     hint: 'Lo que vas a invertir este período' },
]

const EMPTY_ITEM = { name: '', item_type: 'fixed', amount_type: 'fixed', amount: '', currency: 'HNL', category: '', is_active: true }

export default function PlanPage() {
  const [summary, setSummary] = useState(null)
  const [plan, setPlan] = useState(null)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [refDate, setRefDate] = useState(null)
  const [loading, setLoading] = useState(true)

  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [itemErrors, setItemErrors] = useState({})

  const [settingsModal, setSettingsModal] = useState(false)
  const [planForm, setPlanForm] = useState({})
  const [planErrors, setPlanErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const loadSummary = useCallback(async (date) => {
    setSummary(await planningService.getSummary(date))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, it, cats] = await Promise.all([
        planningService.getPlan(),
        planningService.listItems(),
        expenseService.getCategories(),
      ])
      setPlan(p)
      setItems(it)
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadSummary(refDate) }, [loadSummary, refDate])

  const refresh = async () => {
    const [it] = await Promise.all([planningService.listItems(), loadSummary(refDate)])
    setItems(it)
  }

  //  Items
  const openItem = (type = 'fixed', item = null) => {
    setEditingItem(item)
    setItemForm(item
      ? { name: item.name, item_type: item.item_type, amount_type: item.amount_type, amount: item.amount,
          currency: item.currency, category: item.category || '', is_active: item.is_active }
      : { ...EMPTY_ITEM, item_type: type })
    setItemErrors({})
    setItemModal(true)
  }
  const onItemChange = (e) => {
    const { name, value, type, checked } = e.target
    setItemForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }
  const saveItem = async (e) => {
    e.preventDefault()
    setSaving(true)
    setItemErrors({})
    try {
      if (editingItem) await planningService.updateItem(editingItem.id, itemForm)
      else await planningService.createItem(itemForm)
      setItemModal(false)
      await refresh()
    } catch (err) {
      if (err.response?.data) setItemErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }
  const deleteItem = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.name}" del plan?`)) return
    await planningService.removeItem(item.id)
    await refresh()
  }
  const toggleItem = async (item) => {
    await planningService.updateItem(item.id, { is_active: !item.is_active })
    await refresh()
  }

  //  Plan settings
  const openSettings = () => {
    setPlanForm({
      period_type: plan.period_type,
      custom_days: plan.custom_days,
      anchor_date: plan.anchor_date || '',
      expected_income: plan.expected_income ?? '',
      expected_income_currency: plan.expected_income_currency,
    })
    setPlanErrors({})
    setSettingsModal(true)
  }
  const onPlanChange = (e) => setPlanForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const saveSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    setPlanErrors({})
    try {
      const payload = {
        ...planForm,
        anchor_date: planForm.anchor_date || null,
        expected_income: planForm.expected_income === '' ? null : planForm.expected_income,
      }
      const updated = await planningService.updatePlan(payload)
      setPlan(p => ({ ...p, ...updated }))
      setSettingsModal(false)
      setRefDate(null)
      await loadSummary(null)
    } catch (err) {
      if (err.response?.data) setPlanErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !summary || !plan) return <PageSpinner />

  const { period, income, totals, fun, upcoming } = summary
  const summaryItems = Object.fromEntries(summary.items.map(i => [i.id, i]))
  const available = parseFloat(fun.available)
  const spentPct = available > 0 ? Math.min((parseFloat(fun.spent) / available) * 100, 100) : 100
  const periodWord = { biweekly: 'quincena', monthly: 'mes', weekly: 'semana', custom: 'período' }[period.type] || 'período'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de gastos"
        subtitle={`${plan.period_type_display} · lo que entra, lo que debes pagar, guardar e invertir`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={openSettings}><Settings2 size={15} /> Configurar</Button>
            <Button onClick={() => openItem('fixed')}><Plus size={15} /> Agregar partida</Button>
          </div>
        }
      />

      {/* Period navigation */}
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={() => setRefDate(period.prev_date)} title="Período anterior"><ChevronLeft size={16} /></Button>
        <div className="text-center min-w-[200px]">
          <p className="text-lg font-display text-white">{period.label}</p>
          <p className="text-xs text-obsidian-500">
            {formatDate(period.start)} – {formatDate(period.end)}
            {period.is_current && ` · quedan ${period.days_left} día${period.days_left === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button variant="icon" onClick={() => setRefDate(period.next_date)} title="Período siguiente"><ChevronRight size={16} /></Button>
        {!period.is_current && (
          <Button variant="ghost" size="sm" onClick={() => setRefDate(null)}>Ir a hoy</Button>
        )}
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="card p-6 lg:col-span-3">
          <div className="flex items-center gap-2 text-sm text-obsidian-400">
            <PartyPopper size={16} className="text-emerald-400" />
            Para diversión y gastos libres esta {periodWord}
          </div>
          <p className={clsx('text-4xl font-numeric mt-2', parseFloat(fun.remaining) < 0 ? 'text-rose-400' : 'text-emerald-400')}>
            {formatCurrency(fun.remaining)}
          </p>
          <p className="text-sm text-obsidian-400 mt-1">
            {parseFloat(fun.remaining) < 0
              ? 'Te pasaste del plan en esta cantidad.'
              : <>disponible de <span className="font-numeric text-obsidian-200">{formatCurrency(fun.available)}</span> · ya gastaste <span className="font-numeric text-obsidian-200">{formatCurrency(fun.spent)}</span></>}
          </p>
          <div className="w-full bg-obsidian-700 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-700', spentPct >= 100 ? 'bg-rose-500' : spentPct > 75 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          {period.is_current && parseFloat(fun.per_day) > 0 && (
            <p className="text-xs text-obsidian-500 mt-3">
              ≈ <span className="font-numeric text-obsidian-300">{formatCurrency(fun.per_day)}</span> por día durante los {period.days_left} días que quedan.
            </p>
          )}
          {income.basis_source === 'none' && (
            <p className="text-xs text-amber-400 mt-3">
              Aún no hay ingresos en este período. Registra uno o configura un ingreso esperado en "Configurar".
            </p>
          )}
        </div>

        {/* Breakdown */}
        <div className="card p-6 lg:col-span-2 space-y-2.5 text-sm">
          <Row label={income.basis_source === 'expected' ? 'Ingreso esperado' : 'Ingreso del período'} value={income.basis_hnl} positive icon={TrendingUp} />
          <div className="pl-6 -mt-1 text-xs text-obsidian-500 space-y-0.5">
            <p>Recibido: <span className="font-numeric">{formatCurrency(income.received_hnl)}</span>
              {parseFloat(income.received_by_currency.USD) > 0 && (
                <> ({formatCurrency(income.received_by_currency.USD, 'USD')}{parseFloat(income.received_by_currency.HNL) > 0 && <> + {formatCurrency(income.received_by_currency.HNL)}</>})</>
              )}
            </p>
            {parseFloat(income.pending_hnl) > 0 && <p>Falta por recibir: <span className="font-numeric">{formatCurrency(income.pending_hnl)}</span></p>}
          </div>
          <Row label="Gastos fijos" value={totals.fixed_committed} icon={Receipt} />
          <Row label="Ahorro / reserva" value={totals.savings_planned} icon={PiggyBank} />
          <Row label="Inversión" value={totals.investment_committed} icon={LineChart} />
          <Row label="Gastos próximos / emergencias" value={parseFloat(totals.upcoming_reserved) + parseFloat(totals.planned_paid)} icon={CalendarClock} />
          <div className="border-t border-white/[0.06] pt-2.5">
            <Row label="Disponible para diversión" value={fun.available} strong />
          </div>
          <Row label="Ya gastado en diversión / otros" value={fun.spent} />
          <div className="border-t border-white/[0.06] pt-2.5">
            <Row label="Te queda" value={fun.remaining} strong />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {SECTIONS.map(sec => {
          const secItems = items.filter(i => i.item_type === sec.type)
          const Icon = sec.icon
          return (
            <div key={sec.type} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={sec.color} />
                  <h2 className="font-display text-obsidian-100">{sec.title}</h2>
                </div>
                <button onClick={() => openItem(sec.type)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white" title="Agregar">
                  <Plus size={14} />
                </button>
              </div>
              {secItems.length === 0 ? (
                <p className="text-xs text-obsidian-500">{sec.hint}</p>
              ) : (
                <div className="space-y-1">
                  {secItems.map(item => {
                    const s = summaryItems[item.id]
                    const over = s?.remaining_hnl != null && parseFloat(s.remaining_hnl) < 0
                    return (
                      <div key={item.id} className={clsx('group rounded-xl px-3 py-2 table-row-hover', !item.is_active && 'opacity-40')}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-obsidian-200 truncate">{item.name}</p>
                            <p className="text-xs text-obsidian-500">
                              {item.amount_type === 'percent'
                                ? `${parseFloat(item.amount)}% del ingreso`
                                : formatCurrency(item.amount, item.currency)}
                              {item.category_display && <> · {item.category_display}</>}
                              {!item.is_active && ' · pausada'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-numeric text-sm text-obsidian-100">{s ? formatCurrency(s.planned_hnl) : '—'}</span>
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button title="Editar" onClick={() => openItem(item.item_type, item)} className="p-1 rounded hover:bg-white/10 text-obsidian-400 hover:text-white"><Pencil size={12} /></button>
                              <button title={item.is_active ? 'Pausar' : 'Activar'} onClick={() => toggleItem(item)} className="p-1 rounded hover:bg-white/10 text-obsidian-400 hover:text-white text-[10px] font-medium">
                                {item.is_active ? '❚❚' : '▶'}
                              </button>
                              <button title="Eliminar" onClick={() => deleteItem(item)} className="p-1 rounded hover:bg-rose-500/10 text-obsidian-400 hover:text-rose-400"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </div>
                        {s?.spent_hnl != null && (
                          <div className="mt-1.5">
                            <div className="w-full bg-obsidian-700 rounded-full h-1 overflow-hidden">
                              <div className={clsx('h-full rounded-full', over ? 'bg-rose-500' : 'bg-emerald-500')}
                                style={{ width: `${Math.min((parseFloat(s.spent_hnl) / Math.max(parseFloat(s.planned_hnl), 0.01)) * 100, 100)}%` }} />
                            </div>
                            <p className={clsx('text-[11px] mt-1', over ? 'text-rose-400' : 'text-obsidian-500')}>
                              Pagado {formatCurrency(s.spent_hnl)} · {over ? `te pasaste ${formatCurrency(-s.remaining_hnl)}` : `falta ${formatCurrency(s.remaining_hnl)}`}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {sec.type === 'investment' && parseFloat(totals.investment_actual) > 0 && (
                    <p className="text-xs text-obsidian-500 px-3 pt-1">Invertido en este período: <span className="font-numeric">{formatCurrency(totals.investment_actual)}</span></p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upcoming + variable spending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-amber-400" />
              <h2 className="font-display text-obsidian-100">Gastos próximos en este período</h2>
            </div>
            <Link to="/upcoming" className="text-xs text-emerald-400 hover:text-emerald-300">Ver todos →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-obsidian-500">Nada pendiente que venza en este período.</p>
          ) : (
            <div className="space-y-1">
              {upcoming.map(u => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-xl table-row-hover">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.is_emergency && <AlertTriangle size={13} className="text-rose-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm text-obsidian-200 truncate">{u.name}</p>
                      <p className={clsx('text-xs', u.is_overdue ? 'text-rose-400' : 'text-obsidian-500')}>
                        {u.is_overdue ? 'Vencido · ' : 'Vence '}{formatDate(u.due_date)}
                      </p>
                    </div>
                  </div>
                  <span className="font-numeric text-sm text-amber-400">{formatCurrency(u.amount, u.currency)}</span>
                </div>
              ))}
            </div>
          )}
          {parseFloat(totals.planned_paid) > 0 && (
            <p className="text-xs text-obsidian-500 mt-3 px-3">Ya pagados en este período: <span className="font-numeric">{formatCurrency(totals.planned_paid)}</span></p>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <PartyPopper size={16} className="text-emerald-400" />
            <h2 className="font-display text-obsidian-100">En qué se fue lo libre</h2>
          </div>
          {summary.variable_by_category.length === 0 ? (
            <p className="text-xs text-obsidian-500">Todavía no hay gastos fuera del plan en este período.</p>
          ) : (
            <div className="space-y-2">
              {summary.variable_by_category.map(c => (
                <div key={c.category} className="flex items-center justify-between px-3">
                  <CategoryBadge category={c.category} label={c.label} />
                  <span className="font-numeric text-sm text-obsidian-200">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Item modal */}
      <Modal open={itemModal} onClose={() => setItemModal(false)} title={editingItem ? 'Editar partida' : 'Nueva partida del plan'}>
        <form onSubmit={saveItem} className="space-y-4">
          <Input label="Nombre" name="name" value={itemForm.name} onChange={onItemChange}
            placeholder="Ej. Universidad, Gasolina, Reparaciones" error={itemErrors.name?.[0]} required />
          <Select label="Tipo" name="item_type" value={itemForm.item_type} onChange={onItemChange}>
            <option value="fixed">Gasto fijo (hay que pagarlo)</option>
            <option value="savings">Ahorro / reserva (guardarlo)</option>
            <option value="investment">Inversión</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="¿Cómo se calcula?" name="amount_type" value={itemForm.amount_type} onChange={onItemChange}>
              <option value="fixed">Monto fijo</option>
              <option value="percent">% del ingreso</option>
            </Select>
            {itemForm.amount_type === 'fixed' ? (
              <Select label="Moneda" name="currency" value={itemForm.currency} onChange={onItemChange}>
                <option value="HNL">Lempiras (L)</option>
                <option value="USD">Dólares ($)</option>
              </Select>
            ) : <div />}
          </div>
          <Input
            label={itemForm.amount_type === 'percent' ? 'Porcentaje (%)' : `Monto por ${periodWord}`}
            name="amount" type="number" step="0.01" min="0.01"
            max={itemForm.amount_type === 'percent' ? 100 : undefined}
            value={itemForm.amount} onChange={onItemChange} error={itemErrors.amount?.[0]} required
          />
          {itemForm.item_type === 'fixed' && (
            <Select label="Categoría de gasto (para ver cuánto ya pagaste)" name="category" value={itemForm.category} onChange={onItemChange}>
              <option value="">— Ninguna —</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          )}
          <label className="flex items-center gap-2 text-sm text-obsidian-300">
            <input type="checkbox" name="is_active" checked={itemForm.is_active} onChange={onItemChange} />
            Activa en el plan
          </label>
          {itemErrors.non_field_errors?.[0] && <p className="text-rose-400 text-xs">{itemErrors.non_field_errors[0]}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setItemModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">{editingItem ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Settings modal */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="Configurar plan">
        <form onSubmit={saveSettings} className="space-y-4">
          <Select label="Cada cuánto planificas" name="period_type" value={planForm.period_type} onChange={onPlanChange}
            error={planErrors.period_type?.[0]}>
            {(plan.options?.period_types || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {planForm.period_type === 'custom' && (
            <Input label="Número de días por período" name="custom_days" type="number" min="1" max="366"
              value={planForm.custom_days} onChange={onPlanChange} error={planErrors.custom_days?.[0]} />
          )}
          {(planForm.period_type === 'custom' || planForm.period_type === 'weekly') && (
            <Input label="Fecha de inicio del primer período" name="anchor_date" type="date"
              value={planForm.anchor_date} onChange={onPlanChange} error={planErrors.anchor_date?.[0]} />
          )}
          <div className="grid grid-cols-3 gap-3">
            <Input className="col-span-2" label="Ingreso esperado por período (opcional)" name="expected_income" type="number" step="0.01" min="0"
              value={planForm.expected_income} onChange={onPlanChange} error={planErrors.expected_income?.[0]}
              placeholder="Ej. 1000" />
            <Select label="Moneda" name="expected_income_currency" value={planForm.expected_income_currency} onChange={onPlanChange}>
              <option value="USD">$</option>
              <option value="HNL">L</option>
            </Select>
          </div>
          <p className="text-xs text-obsidian-500 -mt-2">
            Se usa para planificar antes de que te paguen. Cuando registres ingresos mayores, se usa lo recibido.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSettingsModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Row({ label, value, positive, strong, icon: Icon }) {
  const num = parseFloat(value) || 0
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={clsx('flex items-center gap-2', strong ? 'text-obsidian-100 font-medium' : 'text-obsidian-400')}>
        {Icon ? <Icon size={14} className="text-obsidian-500" /> : <span className="w-[14px]" />}
        {label}
      </span>
      <span className={clsx('font-numeric',
        strong ? (num < 0 ? 'text-rose-400' : 'text-emerald-400') : positive ? 'text-emerald-400' : 'text-obsidian-200')}>
        {positive || strong ? formatCurrency(num) : `− ${formatCurrency(Math.abs(num))}`}
      </span>
    </div>
  )
}
