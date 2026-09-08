import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the env vars are missing — the app shows a setup screen instead. */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error(
    '[Encryptext] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local, fill it in, and restart `npm run dev`.',
  )
}

export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
)

export type SupabaseClient = typeof supabase
