import { useCallback, useEffect, useState } from 'react'
import accountService from '../services/accountService'

/** The user's accounts (unpaginated). `active` excludes archived ones. */
export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setAccounts(await accountService.list())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return { accounts, active: accounts.filter(a => !a.is_archived), loading, reload }
}
