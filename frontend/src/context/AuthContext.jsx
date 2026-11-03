/**
 * AuthContext.jsx
 * Global authentication state. Provides user, login, logout across the app.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hydrate user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      authService.getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    await authService.login(email, password)
    const me = await authService.getMe()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await authService.getMe()
    setUser(me)
    return me
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
