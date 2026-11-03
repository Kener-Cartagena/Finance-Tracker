/**
 * utils/format.js
 * Shared formatting utilities for currency, dates, and percentages.
 */

import dayjs from 'dayjs'

export const formatCurrency = (amount, currency = 'USD') => {
  const num = parseFloat(amount) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export const formatDate = (date, fmt = 'MMM D, YYYY') =>
  dayjs(date).format(fmt)

export const formatPercent = (value) =>
  `${parseFloat(value || 0).toFixed(1)}%`

export const formatShort = (amount) => {
  const num = parseFloat(amount) || 0
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (Math.abs(num) >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`
  return formatCurrency(num)
}

// Category color map for charts
export const CATEGORY_COLORS = {
  food:          '#10b981',
  transport:     '#0ea5e9',
  entertainment: '#f59e0b',
  housing:       '#8b5cf6',
  health:        '#ec4899',
  clothing:      '#f43f5e',
  internet:      '#06b6d4',
  gasoline:      '#f97316',
  university:    '#3b82f6',
  personal_care: '#a78bfa',
  gifts:         '#fb7185',
  family:        '#34d399',
  subscriptions: '#fbbf24',
  other:         '#5c5c6d',
}

export const INVESTMENT_COLORS = {
  stocks:      '#10b981',
  crypto:      '#f59e0b',
  bonds:       '#0ea5e9',
  etf:         '#8b5cf6',
  real_estate: '#f43f5e',
  other:       '#5c5c6d',
}
