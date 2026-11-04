/**
 * UpcomingPage — gastos futuros y de emergencia.
 * Ej. "Le falla algo al carro y sé que pronto tendré que pagarlo": se registra
 * con monto estimado y fecha; el plan lo reserva y al pagarlo se crea el gasto real.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, CalendarClock, AlertTriangle, CheckCircle2, RotateCcw, XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import planningService from '../services/planningService'
import expenseService from '../services/expenseService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Select, Textarea } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { CategoryBadge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, formatDate } from '../utils/format'
import { todayISO } from '../utils/dates'

const TABS = [
  { key: 'pending',   label: 'Pendientes' },
  { key: 'paid',      label: 'Pagados' },
  { key: 'cancelled', label: 'Cancelados' },
]

const emptyForm = (rate) => ({
  name: '', amount: '', currency: 'HNL', exchange_rate: rate ?? '', due_date: '',
  is_emergency: false, category: 'repairs', notes: '',
})

function dueText(days) {
  if (days < 0) return `Vencido hace ${-days} día${days === -1 ? '' : 's'}`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `En ${days} días`
}

export default function UpcomingPage() {
  const { user } = useAuth()
  const { active: accounts } = useAccounts()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => emptyForm(user?.exchange_rate))
  const [errors, setErrors] = useState({})

  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm] = useState({})
  const [payErrors, setPayErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await planningService.listPlanned()
      setItems(data.results || data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { expenseService.getCategories().then(setCategories) }, [])

  //  Create / edit
  const openCreate = (emergency = false) => {
    setEditing(null)
    setForm({ ...emptyForm(user?.exchange_rate), is_emergency: emergency, category: emergency ? 'emergency' : 'repairs' })
    setErrors({})
    setModal(true)
  }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name, amount: p.amount, currency: p.currency, exchange_rate: p.exchange_rate, due_date: p.due_date,
      is_emergency: p.is_emergency, category: p.category, notes: p.notes || '',
    })
    setErrors({})
    setModal(true)
  }
  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (editing) await planningService.updatePlanned(editing.id, form)
      else await planningService.createPlanned(form)
      setModal(false)
      setTab('pending')
      await load()
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  //  Pay
  const openPay = (p) => {
    setPayTarget(p)
    const acc = accounts.find(a => a.currency === p.currency)
    setPayForm({ account: acc?.id ?? '', amount: p.amount, date: todayISO(), exchange_rate: user?.exchange_rate ?? '' })
    setPayErrors({})
  }
  const onPayChange = (e) => setPayForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const payAccount = accounts.find(a => String(a.id) === String(payForm.account))
  const payCurrency = payAccount ? payAccount.currency : payTarget?.currency

  const pay = async (e) => {
    e.preventDefault()
    setSaving(true)
    setPayErrors({})
    const payload = {
      amount: payForm.amount,
      date: payForm.date,
      account: payForm.account === '' ? null : Number(payForm.account),
    }
    if (!payAccount) payload.currency = payTarget.currency
    if (payCurrency === 'USD' && payForm.exchange_rate) payload.exchange_rate = payForm.exchange_rate
    try {
      await planningService.payPlanned(payTarget.id, payload)
      setPayTarget(null)
      await load()
    } catch (err) {
      if (err.response?.data) setPayErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const reopen = async (p) => {
    if (!window.confirm('Se eliminará el gasto registrado y volverá a pendiente. ¿Continuar?')) return
    await planningService.reopenPlanned(p.id)
    await load()
  }
  const cancel = async (p) => {
    if (!window.confirm(`¿Ya no necesitas pagar "${p.name}"?`)) return
    await planningService.cancelPlanned(p.id)
    await load()
  }
  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}"? (si estaba pagado, el gasto registrado se conserva)`)) return
    await planningService.removePlanned(p.id)
    await load()
  }

  const visible = items.filter(i => i.status === tab)
  const pending = items.filter(i => i.status === 'pending')
  const pendingTotal = pending.reduce((s, i) => s + parseFloat(i.amount_hnl), 0)
  const emergencyTotal = pending.filter(i => i.is_emergency).reduce((s, i) => s + parseFloat(i.amount_hnl), 0)
  const next30 = pending.filter(i => i.days_until_due <= 30).reduce((s, i) => s + parseFloat(i.amount_hnl), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos próximos"
        subtitle="Lo que sabes que vas a tener que pagar, con fecha"
        action={
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => openCreate(true)}><AlertTriangle size={15} /> Emergencia</Button>
            <Button onClick={() => openCreate(false)}><Plus size={15} /> Gasto futuro</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-obsidian-400">Total pendiente</p>
          <p className="text-2xl font-numeric text-amber-400 mt-1">{formatCurrency(pendingTotal)}</p>
          <p className="text-xs text-obsidian-500 mt-1">{pending.length} gasto{pending.length === 1 ? '' : 's'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-obsidian-400">Próximos 30 días</p>
          <p className="text-2xl font-numeric text-obsidian-100 mt-1">{formatCurrency(next30)}</p>
          <p className="text-xs text-obsidian-500 mt-1">incluye vencidos</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-obsidian-400">Emergencias pendientes</p>
          <p className="text-2xl font-numeric text-rose-400 mt-1">{formatCurrency(emergencyTotal)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              tab === t.key
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-white/[0.03] text-obsidian-400 border-white/[0.07] hover:text-obsidian-200')}>
            {t.label} ({items.filter(i => i.status === t.key).length})
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><PageSpinner /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={tab === 'pending' ? 'No tienes gastos próximos' : 'Nada por aquí'}
            description={tab === 'pending' ? 'Ej. "Reparar frenos del carro" — L 3,500 — para el 20 de noviembre.' : undefined}
            action={tab === 'pending' && <Button size="sm" onClick={() => openCreate(false)}><Plus size={14} /> Gasto futuro</Button>}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {visible.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4 table-row-hover group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    p.is_emergency ? 'bg-rose-500/10' : 'bg-amber-500/10')}>
                    {p.is_emergency
                      ? <AlertTriangle size={15} className="text-rose-400" />
                      : <CalendarClock size={15} className="text-amber-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-obsidian-100 truncate">{p.name}</p>
                      <CategoryBadge category={p.category} label={p.category_display} />
                    </div>
                    <p className={clsx('text-xs mt-0.5',
                      p.status === 'pending' && p.days_until_due < 0 ? 'text-rose-400'
                        : p.status === 'pending' && p.days_until_due <= 7 ? 'text-amber-400' : 'text-obsidian-500')}>
                      {formatDate(p.due_date)}
                      {p.status === 'pending' && <> · {dueText(p.days_until_due)}</>}
                      {p.status === 'paid' && p.paid_date && <> · pagado el {formatDate(p.paid_date)}</>}
                      {p.notes && <> · {p.notes}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-numeric text-sm text-obsidian-100">{formatCurrency(p.amount, p.currency)}</p>
                    {p.currency === 'USD' && <p className="text-xs font-numeric text-obsidian-500">≈ {formatCurrency(p.amount_hnl)}</p>}
                  </div>
                  {p.status === 'pending' && (
                    <Button size="sm" onClick={() => openPay(p)}><CheckCircle2 size={13} /> Pagar</Button>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.status === 'pending' && (
                      <>
                        <button title="Editar" onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white"><Pencil size={13} /></button>
                        <button title="Ya no se necesita" onClick={() => cancel(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white"><XCircle size={13} /></button>
                      </>
                    )}
                    {p.status !== 'pending' && (
                      <button title="Volver a pendiente" onClick={() => reopen(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white"><RotateCcw size={13} /></button>
                    )}
                    <button title="Eliminar" onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-obsidian-400 hover:text-rose-400"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar gasto próximo' : (form.is_emergency ? 'Nueva emergencia' : 'Nuevo gasto futuro')}>
        <form onSubmit={save} className="space-y-4">
          <Input label="¿Qué hay que pagar?" name="name" value={form.name} onChange={onChange}
            placeholder="Ej. Reparar frenos del carro" error={errors.name?.[0]} required />
          <div className="grid grid-cols-3 gap-3">
            <Input className="col-span-2" label="Monto estimado" name="amount" type="number" step="0.01" min="0.01"
              value={form.amount} onChange={onChange} error={errors.amount?.[0]} required />
            <Select label="Moneda" name="currency" value={form.currency} onChange={onChange}>
              <option value="HNL">L</option>
              <option value="USD">$</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="¿Para cuándo?" name="due_date" type="date" value={form.due_date} onChange={onChange}
              error={errors.due_date?.[0]} required />
            <Select label="Categoría" name="category" value={form.category} onChange={onChange}>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-obsidian-300">
            <input type="checkbox" name="is_emergency" checked={form.is_emergency} onChange={onChange} />
            Es una emergencia
          </label>
          <Textarea label="Notas (opcional)" name="notes" value={form.notes} onChange={onChange} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Pay */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={`Pagar: ${payTarget?.name || ''}`}>
        <form onSubmit={pay} className="space-y-4">
          <p className="text-sm text-obsidian-400">
            Se registrará como gasto real y saldrá del plan. Estimado: <span className="font-numeric text-obsidian-200">
              {payTarget && formatCurrency(payTarget.amount, payTarget.currency)}</span>
          </p>
          <Select label="¿De qué cuenta salió?" name="account" value={payForm.account} onChange={onPayChange} error={payErrors.account?.[0]}>
            <option value="">— Sin cuenta —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label={`Monto pagado (${payCurrency})`} name="amount" type="number" step="0.01" min="0.01"
              value={payForm.amount} onChange={onPayChange} error={payErrors.amount?.[0]} required />
            <Input label="Fecha" name="date" type="date" value={payForm.date} onChange={onPayChange} error={payErrors.date?.[0]} required />
          </div>
          {payTarget && payCurrency !== payTarget.currency && (
            <p className="text-xs text-amber-400 -mt-2">La cuenta está en {payCurrency}: escribe el monto en esa moneda.</p>
          )}
          {payCurrency === 'USD' && (
            <Input label="Tasa de cambio (L por $1)" name="exchange_rate" type="number" step="0.0001" min="0.0001"
              value={payForm.exchange_rate} onChange={onPayChange} error={payErrors.exchange_rate?.[0]} />
          )}
          {payErrors.detail && <p className="text-rose-400 text-xs">{payErrors.detail}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPayTarget(null)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">Registrar pago</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
