import clsx from 'clsx'

const variants = {
  primary: 'btn-primary',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
  icon:    'p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.07] hover:border-white/[0.15] transition-all duration-150 text-obsidian-300 hover:text-white',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-7 py-3 text-base' : ''
  return (
    <button
      className={clsx(variants[variant], sizeClass, 'inline-flex items-center gap-2', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
