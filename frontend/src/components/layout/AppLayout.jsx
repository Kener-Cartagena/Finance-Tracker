import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import { PageSpinner } from '../ui/Spinner'

export default function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
