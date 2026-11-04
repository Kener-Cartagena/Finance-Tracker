/**
 * ExpensePieChart — Recharts PieChart for expenses by category.
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CATEGORY_COLORS, formatCurrency } from '../../utils/format'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="font-medium text-obsidian-100">{d.name}</p>
      <p className="text-emerald-400 font-numeric">{formatCurrency(d.value)}</p>
      <p className="text-obsidian-400">{d.payload.count} gastos</p>
    </div>
  )
}

export default function ExpensePieChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-obsidian-500 text-sm">
      Sin gastos en este rango
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell
              key={entry.category}
              fill={CATEGORY_COLORS[entry.category] || '#5c5c6d'}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(val) => (
            <span className="text-xs text-obsidian-400">{val}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
