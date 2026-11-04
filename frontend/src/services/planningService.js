import api from './api'

const planningService = {
  // Plan settings (period type, expected income…)
  async getPlan() {
    const { data } = await api.get('/api/planning/plan/')
    return data
  },
  async updatePlan(payload) {
    const { data } = await api.patch('/api/planning/plan/', payload)
    return data
  },

  // Summary for the period that contains `date` (YYYY-MM-DD, default today)
  async getSummary(date) {
    const { data } = await api.get('/api/planning/summary/', { params: date ? { date } : {} })
    return data
  },

  // Budget items
  async listItems() {
    const { data } = await api.get('/api/planning/items/')
    return data
  },
  async createItem(payload) {
    const { data } = await api.post('/api/planning/items/', payload)
    return data
  },
  async updateItem(id, payload) {
    const { data } = await api.patch(`/api/planning/items/${id}/`, payload)
    return data
  },
  async removeItem(id) {
    await api.delete(`/api/planning/items/${id}/`)
  },

  // Upcoming / emergency expenses
  async listPlanned(params = {}) {
    const { data } = await api.get('/api/planning/planned-expenses/', { params: { page_size: 100, ...params } })
    return data
  },
  async createPlanned(payload) {
    const { data } = await api.post('/api/planning/planned-expenses/', payload)
    return data
  },
  async updatePlanned(id, payload) {
    const { data } = await api.patch(`/api/planning/planned-expenses/${id}/`, payload)
    return data
  },
  async removePlanned(id) {
    await api.delete(`/api/planning/planned-expenses/${id}/`)
  },
  async payPlanned(id, payload = {}) {
    const { data } = await api.post(`/api/planning/planned-expenses/${id}/pay/`, payload)
    return data
  },
  async reopenPlanned(id) {
    const { data } = await api.post(`/api/planning/planned-expenses/${id}/reopen/`)
    return data
  },
  async cancelPlanned(id) {
    const { data } = await api.post(`/api/planning/planned-expenses/${id}/cancel/`)
    return data
  },
}

export default planningService
