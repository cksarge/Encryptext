import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Spinner } from '@/components/ui/primitives'

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}

/** Requires a signed-in user; otherwise bounces to the landing page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

/** For auth screens: if already signed in, skip straight to the app. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <FullPageSpinner />
  if (user) return <Navigate to="/app" replace />
  return <>{children}</>
}
