import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { INVESTMENT_COLORS, formatCurrency } from '../../utils/format'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="font-medium text-obsidian-100">{d.name}</p>
      <p className="text-sky-400 font-numeric">{formatCurrency(d.value)}</p>
    </div>
  )
}

export default function InvestmentDonut({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-obsidian-500 text-sm">
      No investments yet
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="label"
          cx="50%" cy="50%" innerRadius={45} outerRadius={75}
          paddingAngle={3} strokeWidth={0}>
          {data.map((e) => (
            <Cell key={e.type} fill={INVESTMENT_COLORS[e.type] || '#5c5c6d'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
