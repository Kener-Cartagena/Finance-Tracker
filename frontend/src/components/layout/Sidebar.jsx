import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, TrendingDown, Target,
  LineChart, LogOut, Power
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/incomes',     label: 'Income',       icon: TrendingUp },
  { to: '/expenses',    label: 'Expenses',     icon: TrendingDown },
  { to: '/goals',       label: 'Goals',        icon: Target },
  { to: '/investments', label: 'Investments',  icon: LineChart },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleShutdown = async () => {
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas apagar los servidores y salir del sistema?"
    )
    if (!confirmed) return

    try {
      // Llamada al endpoint de apagado del backend
      await fetch('/api/shutdown/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Incluye token de autorización si tu API lo requiere
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
        }
      })
    } catch (error) {
      // Si la conexión cae inmediatamente, es normal debido al taskkill
      console.log('Servidores apágandose...')
    } finally {
      // Intentar cerrar la pestaña actual
      window.close()
      
      // Respaldo por si el navegador bloquea window.close()
      setTimeout(() => {
        document.body.innerHTML = `
          <div style="height:100vh; display:flex; align-items:center; justify-content:center; background:#090d16; color:#a1a1aa; font-family:sans-serif;">
            <div style="text-align:center;">
              <h2 style="color:#f43f5e; margin-bottom:8px;">Servidores apagados</h2>
              <p>Puedes cerrar esta pestaña de forma segura.</p>
            </div>
          </div>
        `
      }, 300)
    }
  }

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col
                      bg-obsidian-950 border-r border-white/[0.06] px-4 py-6">
      {/* Logo */}
      <div className="group flex items-center gap-2.5 px-2 mb-8 cursor-pointer"
          onClick={() => navigate('/dashboard')}>
        <div className="logo-wrap relative w-9 h-9">
          {/* Resplandor pulsante detrás */}
          <span className="absolute inset-0 rounded-xl bg-emerald-500/40 blur-md animate-logo-glow" />
          {/* Logo */}
          <img
            src="/logo.png"
            alt="Ledger"
            className="relative w-9 h-9 object-contain animate-logo-float
                      transition-transform duration-500 ease-out
                      group-hover:scale-110 group-hover:rotate-[360deg]"
          />
        </div>
        <span className="font-display text-lg text-white tracking-tight
                        transition-colors duration-300 group-hover:text-emerald-400">
          Ledger
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-obsidian-400 hover:text-obsidian-200 hover:bg-white/[0.05]'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer & Controles de Sesión / Sistema */}
      <div className="border-t border-white/[0.06] pt-4 mt-4 space-y-1">
        <div className="px-2 mb-3">
          <p className="text-xs font-medium text-obsidian-300 truncate">{user?.full_name || user?.email}</p>
          <p className="text-xs text-obsidian-500 truncate">{user?.email}</p>
        </div>

        {/* Cierre de Sesión */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl
                     text-xs font-medium text-obsidian-400 hover:text-white hover:bg-white/[0.05]
                     transition-all duration-150"
        >
          <LogOut size={14} />
          Sign out
        </button>

        {/* Apagar Sistema Completo */}
        <button
          onClick={handleShutdown}
          title="Apagar servidores y cerrar sistema"
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl
                     text-xs font-medium text-rose-400/80 hover:text-rose-300 
                     bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20
                     transition-all duration-150"
        >
          <Power size={14} className="text-rose-400" />
          Apagar Sistema y Salir
        </button>
      </div>
    </aside>
  )
}