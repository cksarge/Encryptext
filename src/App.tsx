// © 2026 Carter Kasarjian. All rights reserved.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { ThemeProvider } from '@/lib/theme'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ScrollToTop } from '@/components/ScrollToTop'
import { isSupabaseConfigured } from '@/lib/supabase'
import { emailFlowsDisabled } from '@/lib/site'
import { RedirectIfAuthed, RequireAuth } from '@/routes/guards'
import { MissingConfig } from '@/pages/MissingConfig'
import { Landing } from '@/pages/Landing'
import { Security } from '@/pages/Security'
import { Terms } from '@/pages/Terms'
import { Privacy } from '@/pages/Privacy'
import { AuthPage } from '@/pages/AuthPage'
import { AuthConfirm } from '@/pages/AuthConfirm'
import { ResetPassword } from '@/pages/ResetPassword'
import { Dashboard } from '@/pages/Dashboard'
import { NotFound } from '@/pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {!isSupabaseConfigured ? (
          <MissingConfig />
        ) : (
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <ScrollToTop />
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/security" element={<Security />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route
        path="/auth"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route
        path="/auth/reset"
        element={
          emailFlowsDisabled ? (
            <Navigate to="/auth?mode=login" replace />
          ) : (
            <RedirectIfAuthed>
              <ResetPassword />
            </RedirectIfAuthed>
          )
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}
