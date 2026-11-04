import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import IncomesPage from './pages/IncomesPage'
import ExpensesPage from './pages/ExpensesPage'
import GoalsPage from './pages/GoalsPage'
import InvestmentsPage from './pages/InvestmentsPage'
import AccountsPage from './pages/AccountsPage'
import PlanPage from './pages/PlanPage'
import UpcomingPage from './pages/UpcomingPage'
import SingleTabGuard from './components/ui/SingleTabGuard' 

export default function App() {
  return (
    <SingleTabGuard>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/incomes"     element={<IncomesPage />} />
            <Route path="/expenses"    element={<ExpensesPage />} />
            <Route path="/goals"       element={<GoalsPage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/plan"        element={<PlanPage />} />
            <Route path="/upcoming"    element={<UpcomingPage />} />
            <Route path="/accounts"    element={<AccountsPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </SingleTabGuard>
  )
}