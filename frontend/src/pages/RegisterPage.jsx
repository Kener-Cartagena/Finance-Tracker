import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Wallet, Mail, Lock, User, ArrowRight } from 'lucide-react'
import authService from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '', password_confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      await authService.register(form)
      await refreshUser()
      navigate('/dashboard')
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data)
      else setErrors({ detail: 'Registration failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const field = (name, label, type = 'text', icon, placeholder) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-obsidian-500">{icon}</span>}
        <input
          name={name} type={type} value={form[name]}
          onChange={handleChange} placeholder={placeholder}
          className={`input ${icon ? 'pl-9' : ''}`}
          required
        />
      </div>
      {errors[name] && <p className="text-rose-400 text-xs mt-1">{errors[name]?.[0] || errors[name]}</p>}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-obsidian-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-glow-emerald mb-4">
            <Wallet size={22} className="text-white" />
          </div>
          <h1 className="text-3xl font-display text-white">Ledger</h1>
          <p className="text-obsidian-500 text-sm mt-1">Create your account</p>
        </div>

        <div className="card p-8">
          {errors.detail && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl px-4 py-3 mb-5">
              {errors.detail}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {field('first_name', 'First name', 'text', null, 'Ana')}
              {field('last_name',  'Last name',  'text', null, 'Lopez')}
            </div>
            {field('email',            'Email',           'email',    <Mail size={15} />, 'you@example.com')}
            {field('password',         'Password',        'password', <Lock size={15} />, '••••••••')}
            {field('password_confirm', 'Confirm password','password', <Lock size={15} />, '••••••••')}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Create account</span><ArrowRight size={15} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-obsidian-500 text-sm mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
