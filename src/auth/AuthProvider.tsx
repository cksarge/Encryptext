import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ensureDevice } from '@/crypto'
import { hasPasskey, refreshWrappedToken } from '@/auth/passkey'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/types/db'

interface AuthContextValue {
  loading: boolean
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  /** This browser's Olm device is enrolled and ready to encrypt/decrypt. */
  deviceReady: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const enrollingFor = useRef<string | null>(null)

  const user = session?.user ?? null

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
      // Keep the passkey-wrapped refresh token current as Supabase rotates it.
      if (next?.refresh_token && hasPasskey()) {
        void refreshWrappedToken(next.refresh_token)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setDeviceReady(false)
      enrollingFor.current = null
      return
    }
    void loadProfile(user.id)

    if (enrollingFor.current !== user.id) {
      enrollingFor.current = user.id
      setDeviceReady(false)
      ensureDevice(user.id)
        .then(() => setDeviceReady(true))
        .catch((err) => {
          console.error('device enrollment failed', err)
          enrollingFor.current = null
        })
    }
  }, [user, loadProfile])

  const signOut = useCallback(async () => {
    // 'local' so the refresh token isn't revoked server-side — a saved passkey
    // needs it to still be valid on the next sign-in.
    await supabase.auth.signOut({ scope: 'local' })
    setProfile(null)
    setDeviceReady(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user,
      profile,
      deviceReady,
      refreshProfile,
      signOut,
    }),
    [loading, session, user, profile, deviceReady, refreshProfile, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
