export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-display text-white">{title}</h1>
        {subtitle && <p className="text-obsidian-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
