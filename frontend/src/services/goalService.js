import api from './api'

const goalService = {
  async list() {
    const { data } = await api.get('/api/goals/')
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/goals/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`/api/goals/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/goals/${id}/`)
  },
  async contribute(id, payload) {
    const { data } = await api.post(`/api/goals/${id}/contribute/`, payload)
    return data
  },
}

export default goalService
