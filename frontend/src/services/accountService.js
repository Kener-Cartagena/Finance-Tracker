import api from './api'

const accountService = {
  async list(params = {}) {
    const { data } = await api.get('/api/accounts/', { params })
    return data
  },
  async balances() {
    const { data } = await api.get('/api/accounts/balances/')
    return data
  },
  async options() {
    const { data } = await api.get('/api/accounts/options/')
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/accounts/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.patch(`/api/accounts/${id}/`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/accounts/${id}/`)
  },

  // Transfers / currency conversions
  async listTransfers(params = {}) {
    const { data } = await api.get('/api/accounts/transfers/', { params })
    return data
  },
  async createTransfer(payload) {
    const { data } = await api.post('/api/accounts/transfers/', payload)
    return data
  },
  async updateTransfer(id, payload) {
    const { data } = await api.patch(`/api/accounts/transfers/${id}/`, payload)
    return data
  },
  async removeTransfer(id) {
    await api.delete(`/api/accounts/transfers/${id}/`)
  },
}

export default accountService
