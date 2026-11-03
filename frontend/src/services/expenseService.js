import api from './api'

const expenseService = {
  async list(params = {}) {
    const { data } = await api.get('/api/expenses/', { params })
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/expenses/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`/api/expenses/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/expenses/${id}/`)
  },
  async getCategories() {
    const { data } = await api.get('/api/expenses/categories/')
    return data
  },
}

export default expenseService
