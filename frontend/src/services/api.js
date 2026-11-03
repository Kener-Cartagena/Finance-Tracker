/**
 * services/api.js
 *
 * Central Axios instance. Handles:
 * - Base URL from env variable
 * - Attaching JWT access token to every request
 * - Auto-refreshing the token on 401 responses
 * - Redirecting to login when refresh also fails
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: handle 401 → try refresh ───────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, {
          refresh: refreshToken,
        })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
