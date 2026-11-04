/**
 * ExpensesPage — CRUD de gastos con categoría, moneda, cuenta y filtro de fechas.
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, Search, AlertTriangle } from 'lucide-react'
import expenseService from '../services/expenseService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { CategoryBadge } from '../components/ui/Badge'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import MoneyFields, { emptyMoney, moneyFromRecord, moneyPayload } from '../components/ui/MoneyFields'
import { useAuth } from '../context/AuthContext'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, formatDate } from '../utils/format'
import { presetRange, todayISO } from '../utils/dates'

const emptyForm = (rate) => ({ amount: '', category: 'other', description: '', date: todayISO(), ...emptyMoney(rate) })

export default function ExpensesPage() {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const [expenses, setExpenses]   = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(() => emptyForm(user?.exchange_rate))
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch]       = useState('')
  const [range, setRange]         = useState(() => ({ preset: 'month', ...presetRange('month') }))

  useEffect(() => { expenseService.getCategories().then(setCategories) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const expData = await expenseService.list({
        page_size: 100,
        date_after: range.date_from || undefined,
        date_before: range.date_to || undefined,
      })
      setExpenses(expData.results || expData)
    } finally {
      setLoading(false)
    }
  }, [range.date_from, range.date_to])

  useEffect(() => { load() }, [load])

  const openCreate = (preset = {}) => {
    setEditing(null)
    setForm({ ...emptyForm(user?.exchange_rate), ...preset })
    setFormErrors({})
    setModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ amount: item.amount, category: item.category, description: item.description || '', date: item.date, ...moneyFromRecord(item) })
    setFormErrors({})
    setModal(true)
  }

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormErrors({})
    const payload = {
      amount: form.amount, category: form.category, description: form.description, date: form.date,
      ...moneyPayload(form),
    }
    try {
      if (editing) {
        const updated = await expenseService.update(editing.id, payload)
        setExpenses(p => p.map(i => i.id === editing.id ? updated : i))
      } else {
        await expenseService.create(payload)
        await load()
      }
      setModal(false)
    } catch (err) {
      if (err.response?.data) setFormErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return
    setDeleting(id)
    try {
      await expenseService.remove(id)
      setExpenses(p => p.filter(i => i.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const filtered = expenses.filter(e => {
    const matchCat  = !filterCat || e.category === filterCat
    const matchText = !search   || e.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchText
  })

  const totalVisible = filtered.reduce((s, e) => s + parseFloat(e.amount_hnl), 0)
  const formAccounts = accounts.filter(a => !a.is_archived || String(a.id) === String(form.account))

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle="Registra cada gasto, en lempiras o en dólares"
        action={
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => openCreate({ category: 'emergency' })}>
              <AlertTriangle size={15} /> Emergencia
            </Button>
            <Button onClick={() => openCreate()}><Plus size={15} /> Agregar gasto</Button>
          </div>
        }
      />

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500" />
          <input
            className="input pl-9 text-sm py-2 w-52"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select text-sm py-2 w-48"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {filtered.length > 0 && (
          <span className="text-sm text-obsidian-400 ml-auto">
            Total: <span className="font-numeric text-rose-400">{formatCurrency(totalVisible)}</span>
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><PageSpinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No hay gastos en este rango"
            description="Agrega un gasto o ajusta los filtros."
            action={<Button onClick={() => openCreate()} size="sm"><Plus size={14} /> Agregar gasto</Button>}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Categoría', 'Descripción', 'Monto', 'Cuenta', 'Fecha', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-obsidian-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(item => (
                <tr key={item.id} className="table-row-hover group">
                  <td className="px-5 py-3.5">
                    <CategoryBadge category={item.category} label={item.category_display} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-obsidian-200 max-w-xs truncate">
                    {item.description || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-numeric text-sm text-rose-400">
                      -{formatCurrency(item.amount, item.currency)}
                    </span>
                    {item.currency === 'USD' && (
                      <span className="block text-xs text-obsidian-500 font-numeric">≈ {formatCurrency(item.amount_hnl)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-obsidian-400">{item.account_name || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-obsidian-400">{formatDate(item.date)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => openEdit(item)} title="Editar" className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-obsidian-400 hover:text-rose-400 transition-colors"
                      >
                        {deleting === item.id
                          ? <span className="w-3 h-3 border border-rose-400/30 border-t-rose-400 rounded-full animate-spin block" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar gasto' : 'Agregar gasto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Categoría"
            name="category"
            value={form.category}
            onChange={handleChange}
            error={formErrors.category?.[0]}
          >
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Input
            label="Descripción"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Ej. Supermercado de la semana"
            error={formErrors.description?.[0]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              error={formErrors.amount?.[0]}
              required
            />
            <Input
              label="Fecha"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={formErrors.date?.[0]}
              required
            />
          </div>
          <MoneyFields form={form} setForm={setForm} accounts={formAccounts} errors={formErrors} amount={form.amount} />
          {formErrors.non_field_errors?.[0] && <p className="text-rose-400 text-xs">{formErrors.non_field_errors[0]}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              {editing ? 'Guardar cambios' : 'Agregar gasto'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
