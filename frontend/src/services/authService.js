import api from './api'

const authService = {
  async login(email, password) {
    const { data } = await api.post('/api/auth/login/', { email, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    return data
  },

  async register(payload) {
    const { data } = await api.post('/api/auth/register/', payload)
    localStorage.setItem('access_token', data.tokens.access)
    localStorage.setItem('refresh_token', data.tokens.refresh)
    return data
  },

  async logout() {
    const refresh = localStorage.getItem('refresh_token')
    try { await api.post('/api/auth/logout/', { refresh }) } catch (_) {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  async getMe() {
    const { data } = await api.get('/api/auth/me/')
    return data
  },

  async updateMe(payload) {
    const { data } = await api.patch('/api/auth/me/', payload)
    return data
  },

  async changePassword(payload) {
    const { data } = await api.post('/api/auth/change-password/', payload)
    return data
  },
}

export default authService
