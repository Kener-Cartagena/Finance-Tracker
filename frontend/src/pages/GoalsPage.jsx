import { useEffect, useState, useCallback } from 'react'
import { Plus, Target, Pencil, Trash2, PlusCircle } from 'lucide-react'
import goalService from '../services/goalService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { formatCurrency, formatDate } from '../utils/format'
import clsx from 'clsx'

const EMPTY_GOAL   = { name: '', target_amount: '', deadline: '', category: 'investment' }
const EMPTY_CONTRIB = { amount: '', date: new Date().toISOString().slice(0, 10), note: '' }

export default function GoalsPage() {
  const [goals, setGoals]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [goalModal, setGoalModal]       = useState(false)
  const [contribModal, setContribModal] = useState(false)
  const [editing, setEditing]           = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [form, setForm]                 = useState(EMPTY_GOAL)
  const [contribForm, setContribForm]   = useState(EMPTY_CONTRIB)
  const [errors, setErrors]             = useState({})
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await goalService.list()
      setGoals(data.results || data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_GOAL)
    setErrors({})
    setGoalModal(true)
  }

  const openEdit = (goal) => {
    setEditing(goal)
    setForm({
      name:          goal.name,
      target_amount: goal.target_amount,
      deadline:      goal.deadline || '',
      category:      goal.category || 'investment',
    })
    setErrors({})
    setGoalModal(true)
  }

  const openContrib = (goal) => {
    setSelectedGoal(goal)
    setContribForm(EMPTY_CONTRIB)
    setErrors({})
    setContribModal(true)
  }

  const handleChange        = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const handleContribChange = (e) => setContribForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleGoalSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (editing) {
        const updated = await goalService.update(editing.id, form)
        setGoals(p => p.map(g => g.id === editing.id ? updated : g))
      } else {
        const created = await goalService.create(form)
        setGoals(p => [created, ...p])
      }
      setGoalModal(false)
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const handleContribSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const { goal: updated } = await goalService.contribute(selectedGoal.id, contribForm)
      setGoals(p => p.map(g => g.id === updated.id ? updated : g))
      setContribModal(false)
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await goalService.remove(id)
      setGoals(p => p.filter(g => g.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Track your financial goals and milestones"
        action={<Button onClick={openCreate}><Plus size={15} /> New Goal</Button>}
      />

      {loading ? (
        <PageSpinner />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Create your first financial goal to start tracking your progress."
          action={<Button onClick={openCreate} size="sm"><Plus size={14} /> Create Goal</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => openEdit(goal)}
              onDelete={() => handleDelete(goal.id)}
              onContribute={() => openContrib(goal)}
              deleting={deleting === goal.id}
            />
          ))}
        </div>
      )}

      {/* ── Goal create / edit modal ─────────────────────────── */}
      <Modal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        title={editing ? 'Edit Goal' : 'New Goal'}
      >
        <form onSubmit={handleGoalSubmit} className="space-y-4">
          {/* Name */}
          <Input
            label="Goal name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Emergency Fund"
            error={errors.name?.[0]}
            required
          />

          {/* Category — required, only 2 options, no free-text */}
          <div>
            <label className="label">
              Category <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'investment',
                  emoji: '📈',
                  label: 'Investment',
                  desc:  'No balance impact',
                },
                {
                  value: 'expense',
                  emoji: '💸',
                  label: 'Expense',
                  desc:  'Deducted from balance',
                },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, category: opt.value }))}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all duration-150',
                    form.category === opt.value
                      ? opt.value === 'investment'
                        ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                        : 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                      : 'border-white/[0.08] bg-obsidian-800 text-obsidian-400 hover:border-white/20'
                  )}
                >
                  <p className="text-sm font-medium">{opt.emoji} {opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-rose-400 text-xs mt-1">{errors.category[0]}</p>
            )}
          </div>

          {/* Target amount */}
          <Input
            label="Target amount"
            name="target_amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.target_amount}
            onChange={handleChange}
            placeholder="0.00"
            error={errors.target_amount?.[0]}
            required
          />

          {/* Deadline */}
          <Input
            label={<>Deadline <span className="text-obsidian-600">(optional)</span></>}
            name="deadline"
            type="date"
            value={form.deadline}
            onChange={handleChange}
            error={errors.deadline?.[0]}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGoalModal(false)}
              className="flex-1 justify-center"
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              {editing ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Contribution modal ───────────────────────────────── */}
      <Modal
        open={contribModal}
        onClose={() => setContribModal(false)}
        title={`Add to "${selectedGoal?.name}"`}
      >
        <form onSubmit={handleContribSubmit} className="space-y-4">
          {/* Progress preview */}
          {selectedGoal && (
            <div className="bg-obsidian-800/50 rounded-xl p-3 text-sm">
              <div className="flex justify-between text-obsidian-400 mb-2">
                <span>Progress</span>
                <span className="font-numeric">{selectedGoal.progress_percentage?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-obsidian-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(selectedGoal.progress_percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-obsidian-500">
                <span className="font-numeric">{formatCurrency(selectedGoal.current_amount)}</span>
                <span className="font-numeric">{formatCurrency(selectedGoal.target_amount)}</span>
              </div>
              {/* Show category warning if expense */}
              {selectedGoal.category === 'expense' && (
                <p className="text-xs text-rose-400 mt-2 bg-rose-500/10 rounded-lg px-2 py-1.5">
                  💸 This is an <strong>Expense</strong> goal — contributions will be deducted from your net balance.
                </p>
              )}
            </div>
          )}

          <Input
            label="Amount to add"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={contribForm.amount}
            onChange={handleContribChange}
            placeholder="0.00"
            error={errors.amount?.[0] || errors.non_field_errors?.[0]}
            required
          />
          <Input
            label="Date"
            name="date"
            type="date"
            value={contribForm.date}
            onChange={handleContribChange}
            required
          />
          <div>
            <label className="label">
              Note <span className="text-obsidian-600">(optional)</span>
            </label>
            <input
              name="note"
              value={contribForm.note}
              onChange={handleContribChange}
              className="input"
              placeholder="e.g. Monthly contribution"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setContribModal(false)}
              className="flex-1 justify-center"
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              Add Funds
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── GoalCard component ─────────────────────────────────────────────────────
function GoalCard({ goal, onEdit, onDelete, onContribute, deleting }) {
  const pct        = Math.min(goal.progress_percentage || 0, 100)
  const isComplete = goal.is_completed
  const isExpense  = goal.category === 'expense'

  return (
    <div className={clsx(
      'card card-hover p-5 flex flex-col gap-4 animate-slide-up',
      isComplete && 'border-emerald-500/30'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            isComplete ? 'bg-emerald-500/20' : 'bg-obsidian-800'
          )}>
            <Target size={15} className={isComplete ? 'text-emerald-400' : 'text-obsidian-400'} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-obsidian-100 truncate">{goal.name}</p>
            {goal.deadline && (
              <p className="text-xs text-obsidian-500 mt-0.5">Due {formatDate(goal.deadline)}</p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isComplete && (
            <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Done
            </span>
          )}
          <span className={clsx(
            'badge',
            isExpense
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
          )}>
            {isExpense ? '💸 Expense' : '📈 Investment'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-2">
          <span className="text-obsidian-400">Progress</span>
          <span className="font-numeric text-obsidian-300">{pct.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-obsidian-800 rounded-full h-2 overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-700',
              isComplete ? 'bg-emerald-400' : 'bg-emerald-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs font-numeric text-obsidian-400">
            {formatCurrency(goal.current_amount)}
          </span>
          <span className="text-xs font-numeric text-obsidian-500">
            {formatCurrency(goal.target_amount)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-white/[0.05]">
        {!isComplete && (
          <Button onClick={onContribute} size="sm" className="flex-1 justify-center">
            <PlusCircle size={13} /> Add Funds
          </Button>
        )}
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-white/10 text-obsidian-500 hover:text-white transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-2 rounded-lg hover:bg-rose-500/10 text-obsidian-500 hover:text-rose-400 transition-colors"
        >
          {deleting
            ? <span className="w-3 h-3 border border-rose-400/30 border-t-rose-400 rounded-full animate-spin block" />
            : <Trash2 size={13} />
          }
        </button>
      </div>
    </div>
  )
}
