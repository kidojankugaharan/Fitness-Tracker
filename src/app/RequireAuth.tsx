import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-full items-center justify-center" role="status" aria-label="Loading">
      <div className="border-surface-2 border-t-accent size-8 animate-spin rounded-full border-4" />
    </div>
  )
}
