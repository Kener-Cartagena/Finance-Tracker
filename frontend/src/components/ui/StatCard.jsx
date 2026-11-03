/**
 * StatCard — top-level metric cards on the dashboard.
 * Props: title, value, subtitle, icon, trend, color
 */

import clsx from 'clsx'

const colorMap = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rose:    'text-rose-400 bg-rose-500/10 border-rose-500/20',
  sky:     'text-sky-400 bg-sky-500/10 border-sky-500/20',
  amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'emerald', trend }) {
  const colors = colorMap[color] || colorMap.emerald
  const [textColor] = colors.split(' ')

  return (
    <div className="card card-hover p-6 animate-slide-up flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-obsidian-400 font-medium">{title}</p>
          <p className={clsx('text-2xl font-numeric font-medium mt-1', textColor)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-obsidian-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-xl border', colors)}>
            <Icon size={18} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className={clsx(
          'text-xs font-medium flex items-center gap-1',
          trend >= 0 ? 'text-emerald-400' : 'text-rose-400'
        )}>
          <span>{trend >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(trend).toFixed(1)}% vs last month</span>
        </div>
      )}
    </div>
  )
}
