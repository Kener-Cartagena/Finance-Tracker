/**
 * useApi.js
 * Generic hook for async data fetching with loading / error / data states.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi(incomeService.list)
 */

import { useState, useCallback } from 'react'

export function useApi(fn, immediate = false, defaultParams = null) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError]     = useState(null)

  const execute = useCallback(async (params) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(params ?? defaultParams)
      setData(result)
      return result
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.message
        || Object.values(err.response?.data || {})?.[0]?.[0]
        || 'An error occurred.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fn, defaultParams])

  return { data, loading, error, execute, setData }
}
