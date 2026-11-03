import clsx from 'clsx'
import { CATEGORY_COLORS } from '../../utils/format'

const baseColors = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rose:    'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  sky:     'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  purple:  'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  default: 'bg-white/5 text-obsidian-300 border border-white/10',
}

export default function Badge({ children, color = 'default' }) {
  return (
    <span className={clsx('badge', baseColors[color] || baseColors.default)}>
      {children}
    </span>
  )
}

// Category-aware badge with color dot
export function CategoryBadge({ category, label }) {
  const color = CATEGORY_COLORS[category] || '#5c5c6d'
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-obsidian-300">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label || category}
    </span>
  )
}
