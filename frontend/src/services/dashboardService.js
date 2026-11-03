import api from './api'

const dashboardService = {
  async getOverview() {
    const { data } = await api.get('/api/dashboard/overview/')
    return data
  },
  async getGoalsSummary() {
    const { data } = await api.get('/api/dashboard/goals/')
    return data
  },
  async getExpensesByCategory(params = {}) {
    const { data } = await api.get('/api/dashboard/statistics/expenses-by-category/', { params })
    return data
  },
  async getMonthlySummary(months = 12) {
    const { data } = await api.get('/api/dashboard/statistics/monthly-summary/', { params: { months } })
    return data
  },
  async getSavingsRate() {
    const { data } = await api.get('/api/dashboard/statistics/savings-rate/')
    return data
  },
  async getInvestmentsSummary() {
    const { data } = await api.get('/api/dashboard/statistics/investments/')
    return data
  },
}

export default dashboardService
