/**
 * LoginPage — centered auth form with fintech aesthetic.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4
                    bg-obsidian-950 relative overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 mb-4 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
            />
          </div>
          <h1 className="text-3xl font-display text-white">Ledger</h1>
          <p className="text-obsidian-500 text-sm mt-1">Your personal finance command center</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-lg font-display text-obsidian-100 mb-6">Sign in</h2>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm
                            rounded-xl px-4 py-3 mb-5 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-obsidian-500" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-obsidian-500" />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="input pl-9"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Sign in</span><ArrowRight size={15} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-obsidian-500 text-sm mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}