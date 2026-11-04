/**
 * AccountsPage — ¿cuánto tengo y dónde?
 * Cuentas creadas por el usuario (Airtm, Banco Atlántida, Efectivo…), su saldo,
 * el total en lempiras, la tasa de cambio y las transferencias / conversiones.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, Wallet, Landmark, Banknote, Smartphone, ArrowRightLeft, Archive, ArchiveRestore,
} from 'lucide-react'
import clsx from 'clsx'
import accountService from '../services/accountService'
import authService from '../services/authService'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate } from '../utils/format'
import { todayISO } from '../utils/dates'

const KIND_ICONS = { bank: Landmark, wallet: Smartphone, cash: Banknote, other: Wallet }
const KIND_OPTIONS = [
  { value: 'bank', label: 'Banco' },
  { value: 'wallet', label: 'Billetera digital' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'other', label: 'Otro' },
]

const EMPTY_ACCOUNT = { name: '', kind: 'bank', currency: 'HNL', initial_balance: '0', notes: '' }
const emptyTransfer = () => ({ from_account: '', to_account: '', amount: '', amount_received: '', date: todayISO(), notes: '' })

export default function AccountsPage() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Account modal
  const [accModal, setAccModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [accForm, setAccForm] = useState(EMPTY_ACCOUNT)
  const [accErrors, setAccErrors] = useState({})

  // Transfer modal
  const [trModal, setTrModal] = useState(false)
  const [trForm, setTrForm] = useState(emptyTransfer)
  const [trErrors, setTrErrors] = useState({})

  // Exchange rate
  const [rate, setRate] = useState(user?.exchange_rate ?? '')
  const [rateSaved, setRateSaved] = useState(false)

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bal, tr] = await Promise.all([
        accountService.balances(),
        accountService.listTransfers({ page_size: 50 }),
      ])
      setData(bal)
      setTransfers(tr.results || tr)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setRate(user?.exchange_rate ?? '') }, [user?.exchange_rate])

  //  Accounts
  const openCreate = () => { setEditing(null); setAccForm(EMPTY_ACCOUNT); setAccErrors({}); setAccModal(true) }
  const openEdit = (a) => {
    setEditing(a)
    setAccForm({ name: a.name, kind: a.kind, currency: a.currency, initial_balance: a.initial_balance, notes: a.notes || '' })
    setAccErrors({})
    setAccModal(true)
  }
  const onAccChange = (e) => setAccForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const saveAccount = async (e) => {
    e.preventDefault()
    setSaving(true)
    setAccErrors({})
    try {
      if (editing) await accountService.update(editing.id, accForm)
      else await accountService.create(accForm)
      setAccModal(false)
      await load()
    } catch (err) {
      if (err.response?.data) setAccErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async (a) => {
    await accountService.update(a.id, { is_archived: !a.is_archived })
    await load()
  }

  const deleteAccount = async (a) => {
    if (!window.confirm(`¿Eliminar la cuenta "${a.name}"?`)) return
    try {
      await accountService.remove(a.id)
      await load()
    } catch (err) {
      window.alert(err.response?.data?.detail || 'No se pudo eliminar la cuenta.')
    }
  }

  //  Transfers
  const accounts = data?.accounts || []
  const activeAccounts = accounts.filter(a => !a.is_archived)
  const fromAcc = accounts.find(a => String(a.id) === String(trForm.from_account))
  const toAcc = accounts.find(a => String(a.id) === String(trForm.to_account))
  const isConversion = fromAcc && toAcc && fromAcc.currency !== toAcc.currency

  const openTransfer = () => {
    setTrForm({
      ...emptyTransfer(),
      from_account: activeAccounts[0]?.id ?? '',
      to_account: activeAccounts[1]?.id ?? '',
    })
    setTrErrors({})
    setTrModal(true)
  }
  const onTrChange = (e) => setTrForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const saveTransfer = async (e) => {
    e.preventDefault()
    setSaving(true)
    setTrErrors({})
    const payload = { ...trForm }
    if (!isConversion) delete payload.amount_received
    try {
      await accountService.createTransfer(payload)
      setTrModal(false)
      await load()
    } catch (err) {
      if (err.response?.data) setTrErrors(err.response.data)
    } finally {
      setSaving(false)
    }
  }

  const deleteTransfer = async (t) => {
    if (!window.confirm('¿Eliminar esta transferencia?')) return
    await accountService.removeTransfer(t.id)
    await load()
  }

  //  Exchange rate
  const saveRate = async (e) => {
    e.preventDefault()
    if (!(parseFloat(rate) > 0)) return
    await authService.updateMe({ exchange_rate: rate })
    await refreshUser()
    await load()
    setRateSaved(true)
    setTimeout(() => setRateSaved(false), 2000)
  }

  if (loading && !data) return <PageSpinner />

  const visible = accounts.filter(a => showArchived || !a.is_archived)
  const archivedCount = accounts.filter(a => a.is_archived).length
  const effRate = isConversion && trForm.amount && trForm.amount_received
    ? (fromAcc.currency === 'USD'
        ? parseFloat(trForm.amount_received) / parseFloat(trForm.amount)
        : parseFloat(trForm.amount) / parseFloat(trForm.amount_received))
    : null

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuentas"
        subtitle="Cuánto dinero tienes y en qué lugar"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={openTransfer} disabled={activeAccounts.length < 2}>
              <ArrowRightLeft size={15} /> Transferir / cambiar
            </Button>
            <Button onClick={openCreate}><Plus size={15} /> Nueva cuenta</Button>
          </div>
        }
      />

      {/* Totals + rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <p className="text-sm text-obsidian-400">Total en todas tus cuentas</p>
          <p className="text-3xl font-numeric text-emerald-400 mt-1">{formatCurrency(data?.total_hnl)}</p>
          <div className="flex flex-wrap gap-6 mt-3 text-sm">
            <span className="text-obsidian-400">
              En dólares: <span className="font-numeric text-obsidian-200">{formatCurrency(data?.by_currency?.USD, 'USD')}</span>
            </span>
            <span className="text-obsidian-400">
              En lempiras: <span className="font-numeric text-obsidian-200">{formatCurrency(data?.by_currency?.HNL)}</span>
            </span>
          </div>
          <p className="text-xs text-obsidian-500 mt-3">Los dólares se valoran a la tasa actual.</p>
        </div>
        <form onSubmit={saveRate} className="card p-6">
          <label className="label">Tasa de cambio actual</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-obsidian-400 whitespace-nowrap">$1 =</span>
            <span className="text-sm text-obsidian-400">L</span>
            <input className="input font-numeric" type="number" step="0.0001" min="0.0001"
              value={rate} onChange={e => setRate(e.target.value)} />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-obsidian-500">Se usa por defecto en los registros nuevos en dólares.</p>
            <Button type="submit" size="sm">{rateSaved ? 'Guardada ✓' : 'Guardar'}</Button>
          </div>
        </form>
      </div>

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Mis cuentas</h2>
          {archivedCount > 0 && (
            <button className="text-xs text-obsidian-400 hover:text-obsidian-200" onClick={() => setShowArchived(s => !s)}>
              {showArchived ? 'Ocultar archivadas' : `Mostrar archivadas (${archivedCount})`}
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title="Aún no tienes cuentas"
              description="Crea las tuyas: por ejemplo Airtm (USD), Banco Atlántida (HNL) y Efectivo."
              action={<Button size="sm" onClick={openCreate}><Plus size={14} /> Nueva cuenta</Button>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(a => {
              const Icon = KIND_ICONS[a.kind] || Wallet
              return (
                <div key={a.id} className={clsx('card card-hover p-5 group', a.is_archived && 'opacity-50')}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl border text-sky-400 bg-sky-500/10 border-sky-500/20">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-obsidian-100">{a.name}</p>
                        <p className="text-xs text-obsidian-500">{a.kind_display} · {a.currency}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Editar" onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white"><Pencil size={13} /></button>
                      <button title={a.is_archived ? 'Restaurar' : 'Archivar'} onClick={() => toggleArchive(a)} className="p-1.5 rounded-lg hover:bg-white/10 text-obsidian-400 hover:text-white">
                        {a.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      </button>
                      <button title="Eliminar" onClick={() => deleteAccount(a)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-obsidian-400 hover:text-rose-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <p className={clsx('text-2xl font-numeric mt-4', parseFloat(a.balance) < 0 ? 'text-rose-400' : 'text-obsidian-100')}>
                    {formatCurrency(a.balance, a.currency)}
                  </p>
                  {a.currency === 'USD' && (
                    <p className="text-xs text-obsidian-500 font-numeric">≈ {formatCurrency(a.balance_hnl)}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-xs text-obsidian-500">
                    <span>Saldo inicial</span><span className="font-numeric text-right">{formatCurrency(a.initial_balance, a.currency)}</span>
                    <span>Ingresos</span><span className="font-numeric text-right text-emerald-400/80">+{formatCurrency(a.movements.incomes, a.currency)}</span>
                    <span>Gastos</span><span className="font-numeric text-right text-rose-400/80">-{formatCurrency(a.movements.expenses, a.currency)}</span>
                    {parseFloat(a.movements.investments) > 0 && (<>
                      <span>Inversiones</span><span className="font-numeric text-right">-{formatCurrency(a.movements.investments, a.currency)}</span>
                    </>)}
                    {(parseFloat(a.movements.transfers_in) > 0 || parseFloat(a.movements.transfers_out) > 0) && (<>
                      <span>Transferencias</span>
                      <span className="font-numeric text-right">
                        {formatCurrency(parseFloat(a.movements.transfers_in) - parseFloat(a.movements.transfers_out), a.currency)}
                      </span>
                    </>)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Transfers */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Transferencias y cambios de moneda</h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-obsidian-500">
            Cuando pases dólares de Airtm al banco (o muevas dinero entre cuentas), regístralo aquí con "Transferir / cambiar".
          </p>
        ) : (
          <div className="space-y-1">
            {transfers.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl table-row-hover group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 flex-shrink-0">
                    <ArrowRightLeft size={14} className="text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-obsidian-200 truncate">{t.from_account_name} → {t.to_account_name}</p>
                    <p className="text-xs text-obsidian-500">
                      {formatDate(t.date)}
                      {t.from_currency !== t.to_currency && t.effective_rate && (
                        <> · tasa {t.from_currency === 'USD'
                          ? parseFloat(t.effective_rate).toFixed(4)
                          : (1 / parseFloat(t.effective_rate)).toFixed(4)}</>
                      )}
                      {t.notes && <> · {t.notes}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-numeric text-sm text-obsidian-200 text-right">
                    {formatCurrency(t.amount, t.from_currency)}
                    {t.from_currency !== t.to_currency && (
                      <span className="block text-xs text-emerald-400/80">→ {formatCurrency(t.amount_received, t.to_currency)}</span>
                    )}
                  </span>
                  <button title="Eliminar" onClick={() => deleteTransfer(t)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-obsidian-400 hover:text-rose-400 transition-opacity">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account modal */}
      <Modal open={accModal} onClose={() => setAccModal(false)} title={editing ? 'Editar cuenta' : 'Nueva cuenta'}>
        <form onSubmit={saveAccount} className="space-y-4">
          <Input label="Nombre" name="name" value={accForm.name} onChange={onAccChange}
            placeholder="Ej. Airtm, Banco Atlántida, Efectivo" error={accErrors.name?.[0]} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" name="kind" value={accForm.kind} onChange={onAccChange}>
              {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
            <Select label="Moneda" name="currency" value={accForm.currency} onChange={onAccChange} error={accErrors.currency?.[0]}>
              <option value="HNL">Lempiras (L)</option>
              <option value="USD">Dólares ($)</option>
            </Select>
          </div>
          <Input label="Saldo inicial (lo que tienes hoy antes de registrar movimientos)" name="initial_balance" type="number" step="0.01"
            value={accForm.initial_balance} onChange={onAccChange} error={accErrors.initial_balance?.[0]} />
          <Input label="Notas (opcional)" name="notes" value={accForm.notes} onChange={onAccChange} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAccModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">{editing ? 'Guardar' : 'Crear cuenta'}</Button>
          </div>
        </form>
      </Modal>

      {/* Transfer modal */}
      <Modal open={trModal} onClose={() => setTrModal(false)} title="Transferir / cambiar moneda">
        <form onSubmit={saveTransfer} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Desde" name="from_account" value={trForm.from_account} onChange={onTrChange} error={trErrors.from_account?.[0]}>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
            <Select label="Hacia" name="to_account" value={trForm.to_account} onChange={onTrChange} error={trErrors.to_account?.[0]}>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
          </div>
          <div className={clsx('grid gap-3', isConversion ? 'grid-cols-2' : 'grid-cols-1')}>
            <Input label={`Monto enviado${fromAcc ? ` (${fromAcc.currency})` : ''}`} name="amount" type="number" step="0.01" min="0.01"
              value={trForm.amount} onChange={onTrChange} error={trErrors.amount?.[0]} required />
            {isConversion && (
              <Input label={`Monto recibido (${toAcc.currency})`} name="amount_received" type="number" step="0.01" min="0.01"
                value={trForm.amount_received} onChange={onTrChange} error={trErrors.amount_received?.[0]} required />
            )}
          </div>
          {effRate && Number.isFinite(effRate) && (
            <p className="text-xs text-obsidian-500 -mt-2">Tasa efectiva: $1 = L {effRate.toFixed(4)}</p>
          )}
          <Input label="Fecha" name="date" type="date" value={trForm.date} onChange={onTrChange} error={trErrors.date?.[0]} required />
          <Input label="Notas (opcional)" name="notes" value={trForm.notes} onChange={onTrChange} placeholder="Ej. Retiro Airtm a Atlántida" />
          {trErrors.non_field_errors?.[0] && <p className="text-rose-400 text-xs">{trErrors.non_field_errors[0]}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setTrModal(false)} className="flex-1 justify-center">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">Registrar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
