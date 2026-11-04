/**
 * DateRangeFilter — preset chips (Esta quincena, Este mes, …) plus custom dates.
 *
 *   const [range, setRange] = useState(() => ({ preset: 'month', ...presetRange('month') }))
 *   <DateRangeFilter value={range} onChange={setRange} />
 *
 * `value` = { preset, date_from, date_to }
 */

import clsx from 'clsx'
import { CalendarRange } from 'lucide-react'
import { DATE_PRESETS, presetRange } from '../../utils/dates'

export default function DateRangeFilter({ value, onChange, presets = DATE_PRESETS }) {
  const selectPreset = (key) => {
    if (key === 'custom') {
      onChange({ ...value, preset: 'custom' })
    } else {
      onChange({ preset: key, ...presetRange(key) })
    }
  }

  const setDate = (field) => (e) =>
    onChange({ ...value, preset: 'custom', [field]: e.target.value })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange size={14} className="text-obsidian-500" />
      {presets.map(p => (
        <button
          key={p.key}
          type="button"
          onClick={() => selectPreset(p.key)}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
            value.preset === p.key
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-white/[0.03] text-obsidian-400 border-white/[0.07] hover:text-obsidian-200 hover:border-white/[0.15]'
          )}
        >
          {p.label}
        </button>
      ))}
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input py-1.5 text-xs w-36"
            value={value.date_from || ''}
            max={value.date_to || undefined}
            onChange={setDate('date_from')}
            aria-label="Desde"
          />
          <span className="text-obsidian-500 text-xs">a</span>
          <input
            type="date"
            className="input py-1.5 text-xs w-36"
            value={value.date_to || ''}
            min={value.date_from || undefined}
            onChange={setDate('date_to')}
            aria-label="Hasta"
          />
        </div>
      )}
    </div>
  )
}
