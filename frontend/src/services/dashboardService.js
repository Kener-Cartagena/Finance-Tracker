import api from './api'

// `range` = { date_from, date_to } (YYYY-MM-DD, both optional)
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))

const dashboardService = {
  async getOverview(range = {}) {
    const { data } = await api.get('/api/dashboard/overview/', { params: clean(range) })
    return data
  },
  async getGoalsSummary() {
    const { data } = await api.get('/api/dashboard/goals/')
    return data
  },
  async getExpensesByCategory(range = {}) {
    const { data } = await api.get('/api/dashboard/statistics/expenses-by-category/', { params: clean(range) })
    return data
  },
  async getMonthlySummary(range = {}, months = 6) {
    const { data } = await api.get('/api/dashboard/statistics/monthly-summary/', {
      params: clean({ months, ...range }),
    })
    return data
  },
  async getSavingsRate(range = {}) {
    const { data } = await api.get('/api/dashboard/statistics/savings-rate/', { params: clean(range) })
    return data
  },
  async getInvestmentsSummary(range = {}) {
    const { data } = await api.get('/api/dashboard/statistics/investments/', { params: clean(range) })
    return data
  },
}

export default dashboardService
