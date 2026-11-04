/**
 * InvestmentsPage — full CRUD for investment records.
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, LineChart } from 'lucide-react'
import investmentService from '../services/investmentService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { CategoryBadge } from '../components/ui/Badge'
import MoneyFields, { emptyMoney, moneyFromRecord, moneyPayload } from '../components/ui/MoneyFields'
import { useAuth } from '../context/AuthContext'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, formatDate, INVESTMENT_COLORS } from '../utils/format'
import { todayISO } from '../utils/dates'

const emptyForm = (rate) => ({ amount: '', investment_type: 'stocks', platform: '', date: todayISO(), notes: '', ...emptyMoney(rate) })

export default function InvestmentsPage() {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const [investments, setInvestments] = useState([])
  const [types, setTypes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(() => emptyForm(user?.exchange_rate))
  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invData, typesData] = await Promise.all([
        investmentService.list({ page_size: 100 }),
        investmentService.getTypes(),
      ])
      setInvestments(invData.results || invData)
      setTypes(typesData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(user?.exchange_rate))
    setErrors({})
    setModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ amount: item.amount, investment_type: item.investment_type, platform: item.platform, date: item.date, notes: item.notes || '', ...moneyFromRecord(item) })
    setErrors({})
    setModal(true)
  }

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const payload = {
      amount: form.amount, investment_type: form.investment_type, platform: form.platform,
      date: form.date, notes: form.notes, ...moneyPayload(form),
    }
    try {
      if (editing) {
        const updated = await investmentService.update(editing.id, payload)
        setInvestments(p => p.map(i => i.id === editing.id ? updated : i))
      } else {
        const created = await investmentService.create(payload)
        setInvestments(p => [created, ...p])
      }
      setModal(false)
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await investmentService.remove(id)
      setInvestments(p => p.filter(i => i.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const total = investments.reduce((s, i) => s + parseFloat(i.amount_hnl), 0)
  const formAccounts = accounts.filter(a => !a.is_archived || String(a.id) === String(form.account))

  return (
    <div>
      <PageHeader
        title="Investments"
        subtitle="Track money deployed across platforms and asset classes"
        action={<Button onClick={openCreate}><Plus size={15} /> Add Investment</Button>}
      />

      {/* Summary header */}
      {investments.length > 0 && (
        <div className="card p-5 mb-6 flex items-center gap-6">
          <div>
            <p className="text-xs text-obsidian-400 mb-0.5">Total Invested</p>
            <p className="text-2xl font-numeric font-medium text-sky-400">{formatCurrency(total)}</p>
          </div>
          <div className="h-10 w-px bg-white/[0.06]" />
          <div className="flex flex-wrap gap-4">
            {Object.entries(
              investments.reduce((acc, i) => {
                acc[i.investment_type] = (acc[i.investment_type] || 0) + parseFloat(i.amount_hnl)
                return acc
              }, {})
            ).map(([type, amt]) => {
              const color = INVESTMENT_COLORS[type] || '#5c5c6d'
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-obsidian-400 capitalize">{type}</span>
                  <span className="text-xs font-numeric text-obsidian-200">{formatCurrency(amt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><PageSpinner /></div>
        ) : investments.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="No investments tracked"
            description="Add your first investment to start tracking your portfolio."
            action={<Button onClick={openCreate} size="sm"><Plus size={14} /> Add Investment</Button>}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Type', 'Platform', 'Amount', 'Date', 'Notes', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-obsidian-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {investments.map(item => {
                const color = INVESTMENT_COLORS[item.investment_type] || '#5c5c6d'
                return (
                  <tr key={item.id} className="table-row-hover group">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-obsidian-300">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        {item.investment_type_display}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-obsidian-200">{item.platform}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-numeric text-sm text-sky-400">{formatCurrency(item.amount, item.currency)}</span>
                      {item.currency === 'USD' && (
                        <span className="block text-xs text-obsidian-500 font-numeric">≈ {formatCurrency(item.amount_hnl)}</span>
                      )}
                      {item.account_name && <span className="block text-xs text-obsidian-500">desde {item.account_name}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-obsidian-400">{formatDate(item.date)}</td>
                    <td className="px-5 py-3.5 text-sm text-obsidian-500 max-w-xs truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Investment' : 'Add Investment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type"
            name="investment_type"
            value={form.investment_type}
            onChange={handleChange}
            error={errors.investment_type?.[0]}
          >
            {types.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input
            label="Platform"
            name="platform"
            value={form.platform}
            onChange={handleChange}
            placeholder="e.g. Robinhood, Coinbase"
            error={errors.platform?.[0]}
            required
          />
          <Input
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            error={errors.amount?.[0]}
            required
          />
          <Input
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            error={errors.date?.[0]}
            required
          />
          <MoneyFields form={form} setForm={setForm} accounts={formAccounts} errors={errors} amount={form.amount} />
          <div>
            <label className="label">Notes <span className="text-obsidian-600">(optional)</span></label>
            <input name="notes" value={form.notes} onChange={handleChange} className="input" placeholder="e.g. AAPL, BTC" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)} className="flex-1 justify-center">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Add Investment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
