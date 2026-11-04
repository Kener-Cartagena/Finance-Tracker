/**
 * utils/format.js
 * Shared formatting utilities for currency, dates, and percentages.
 */

import dayjs from 'dayjs'

const CURRENCY_SYMBOLS = { HNL: 'L', USD: '$' }

export const currencySymbol = (currency = 'HNL') => CURRENCY_SYMBOLS[currency] || currency

/**
 * formatCurrency(1234.5)         → "L 1,234.50"   (totals are in lempiras)
 * formatCurrency(1234.5, 'USD')  → "$1,234.50"
 */
export const formatCurrency = (amount, currency = 'HNL') => {
  const num = parseFloat(amount) || 0
  const body = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num))
  const sign = num < 0 ? '-' : ''
  if (currency === 'USD') return `${sign}$${body}`
  return `${sign}${currencySymbol(currency)} ${body}`
}

/** "$500.00 + L 1,200.00" from { USD: 500, HNL: 1200 }; skips zero currencies. */
export const formatByCurrency = (byCurrency = {}) => {
  const parts = ['USD', 'HNL']
    .filter(c => parseFloat(byCurrency[c]) > 0)
    .map(c => formatCurrency(byCurrency[c], c))
  return parts.length ? parts.join(' + ') : formatCurrency(0)
}

export const formatDate = (date, fmt = 'D MMM YYYY') =>
  dayjs(date).format(fmt)

export const formatPercent = (value) =>
  `${parseFloat(value || 0).toFixed(1)}%`

export const formatShort = (amount, currency = 'HNL') => {
  const num = parseFloat(amount) || 0
  const sym = currency === 'USD' ? '$' : `${currencySymbol(currency)} `
  if (Math.abs(num) >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`
  if (Math.abs(num) >= 1_000)     return `${sym}${(num / 1_000).toFixed(1)}K`
  return formatCurrency(num, currency)
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
  repairs:       '#eab308',
  emergency:     '#ef4444',
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
