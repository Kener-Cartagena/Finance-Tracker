/**
 * MoneyFields — account + currency + exchange-rate inputs shared by the
 * income, expense and investment forms.
 *
 * Form keys used: account ('' = none), currency ('HNL' | 'USD'), exchange_rate.
 * When an account is picked, the currency follows the account's currency.
 */

import { Select } from './Input'
import { formatCurrency } from '../../utils/format'

export const emptyMoney = (rate) => ({ account: '', currency: 'HNL', exchange_rate: rate ?? '' })

export const moneyFromRecord = (r) => ({
  account: r.account ?? '',
  currency: r.currency || 'HNL',
  exchange_rate: r.exchange_rate ?? '',
})

/** Converts the money part of a form into API payload fields. */
export const moneyPayload = (form) => {
  const payload = {
    account: form.account === '' || form.account == null ? null : Number(form.account),
    currency: form.currency,
  }
  if (form.exchange_rate !== '' && form.exchange_rate != null) payload.exchange_rate = form.exchange_rate
  return payload
}

export default function MoneyFields({ form, setForm, accounts = [], errors = {}, amount, showAccount = true }) {
  const selected = accounts.find(a => String(a.id) === String(form.account))

  const onAccount = (e) => {
    const id = e.target.value
    const acc = accounts.find(a => String(a.id) === id)
    setForm(p => ({ ...p, account: id, currency: acc ? acc.currency : p.currency }))
  }

  const onChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const isUSD = form.currency === 'USD'
  const amountHnl = isUSD && amount && form.exchange_rate
    ? parseFloat(amount) * parseFloat(form.exchange_rate)
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {showAccount && (
          <Select label="Cuenta" name="account" value={form.account ?? ''} onChange={onAccount}
            error={errors.account?.[0]}>
            <option value="">— Sin cuenta —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </Select>
        )}
        <Select
          label="Moneda"
          name="currency"
          value={form.currency}
          onChange={onChange}
          disabled={!!selected}
          error={errors.currency?.[0]}
          className={showAccount ? '' : 'col-span-2'}
        >
          <option value="HNL">Lempiras (L)</option>
          <option value="USD">Dólares ($)</option>
        </Select>
      </div>
      {selected && (
        <p className="text-xs text-obsidian-500 -mt-2">La moneda la define la cuenta {selected.name}.</p>
      )}
      {isUSD && (
        <div>
          <label className="label">Tasa de cambio (L por $1)</label>
          <input
            className="input"
            type="number"
            step="0.0001"
            min="0.0001"
            name="exchange_rate"
            value={form.exchange_rate}
            onChange={onChange}
            required
          />
          {errors.exchange_rate?.[0] && <p className="text-rose-400 text-xs mt-1">{errors.exchange_rate[0]}</p>}
          {amountHnl !== null && !Number.isNaN(amountHnl) && (
            <p className="text-xs text-obsidian-500 mt-1">≈ {formatCurrency(amountHnl)} en lempiras</p>
          )}
        </div>
      )}
    </div>
  )
}
