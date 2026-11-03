export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className="input" {...props} />
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="select" {...props}>
        {children}
      </select>
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input resize-none" rows={3} {...props} />
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
