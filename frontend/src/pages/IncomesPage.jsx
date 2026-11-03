/**
 * IncomesPage — full CRUD for income records.
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Search } from 'lucide-react'
import incomeService from '../services/incomeService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { formatCurrency, formatDate } from '../utils/format'

const EMPTY_FORM = { amount: '', source: '', date: '', notes: '' }

export default function IncomesPage() {
  const [incomes, setIncomes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const data = await incomeService.list(params)
      setIncomes(data.results || data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ amount: item.amount, source: item.source, date: item.date, notes: item.notes || '' })
    setFormErrors({})
    setModal(true)
  }

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormErrors({})
    try {
      if (editing) {
        const updated = await incomeService.update(editing.id, form)
        setIncomes(p => p.map(i => i.id === editing.id ? updated : i))
      } else {
        const created = await incomeService.create(form)
        setIncomes(p => [created, ...p])
      }
      setModal(false)
    } catch (err) {
      if (err.response?.data) setFormErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await incomeService.remove(id)
      setIncomes(p => p.filter(i => i.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const filtered = incomes.filter(i =>
    i.source.toLowerCase().includes(search.toLowerCase())
  )

  const totalVisible = filtered.reduce((sum, i) => sum + parseFloat(i.amount), 0)

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Track all your income sources"
        action={<Button onClick={openCreate}><Plus size={15} /> Add Income</Button>}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500" />
          <input
            className="input pl-9 text-sm py-2"
            placeholder="Search by source…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {filtered.length > 0 && (
          <span className="text-sm text-obsidian-400">
            Total: <span className="font-numeric text-emerald-400">{formatCurrency(totalVisible)}</span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><PageSpinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No income recorded"
            description="Start by adding your first income entry."
            action={<Button onClick={openCreate} size="sm"><Plus size={14} /> Add Income</Button>}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Source', 'Amount', 'Date', 'Notes', ''].map(h => (
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
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <TrendingUp size={12} className="text-emerald-400" />
                      </div>
                      <span className="text-sm text-obsidian-200">{item.source}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-numeric text-sm text-emerald-400">
                      +{formatCurrency(item.amount)}
                    </span>
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Income' : 'Add Income'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Source"
            name="source"
            value={form.source}
            onChange={handleChange}
            placeholder="e.g. Salary, Freelance"
            error={formErrors.source?.[0]}
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
            error={formErrors.amount?.[0]}
            required
          />
          <Input
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            error={formErrors.date?.[0]}
            required
          />
          <div>
            <label className="label">Notes <span className="text-obsidian-600">(optional)</span></label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="input resize-none"
              rows={2}
              placeholder="Any additional notes…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Add Income'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
