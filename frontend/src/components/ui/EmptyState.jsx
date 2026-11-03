export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/[0.07] mb-4">
          <Icon size={24} className="text-obsidian-500" />
        </div>
      )}
      <p className="text-obsidian-300 font-medium">{title}</p>
      {description && <p className="text-obsidian-500 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
