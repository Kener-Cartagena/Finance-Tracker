import api from './api'

const investmentService = {
  async list(params = {}) {
    const { data } = await api.get('/api/investments/', { params })
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/investments/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`/api/investments/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/investments/${id}/`)
  },
  async getTypes() {
    const { data } = await api.get('/api/investments/types/')
    return data
  },
}

export default investmentService
