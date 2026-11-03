import api from './api'

const incomeService = {
  async list(params = {}) {
    const { data } = await api.get('/api/incomes/', { params })
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/incomes/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`/api/incomes/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/incomes/${id}/`)
  },
}

export default incomeService
