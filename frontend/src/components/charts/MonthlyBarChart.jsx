/**
 * MonthlyBarChart — income vs expenses per month (bar + line combo).
 */

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatShort } from '../../utils/format'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs space-y-1">
      <p className="text-obsidian-300 font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-obsidian-400 capitalize">{p.name}</span>
          <span className="font-numeric ml-auto" style={{ color: p.color }}>
            {formatShort(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MonthlyBarChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-obsidian-500 text-sm">
      No monthly data yet
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#5c5c6d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatShort}
          tick={{ fill: '#5c5c6d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="text-xs text-obsidian-400 capitalize">{v}</span>}
        />
        <Bar dataKey="income"   fill="#10b981" radius={[4,4,0,0]} maxBarSize={32} />
        <Bar dataKey="expenses" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={32} />
        <Line dataKey="savings" stroke="#38bdf8" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
