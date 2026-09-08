import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDebouncedValue } from '@/lib/hooks'
import { isValidUsername, normalizeUsername } from '@/lib/utils'

export type UsernameState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'error' }

export function useUsernameAvailability(raw: string): UsernameState {
  const value = useDebouncedValue(normalizeUsername(raw), 400)
  const [state, setState] = useState<UsernameState>({ status: 'idle' })

  useEffect(() => {
    if (value.length === 0) {
      setState({ status: 'idle' })
      return
    }
    if (!isValidUsername(value)) {
      setState({
        status: 'invalid',
        message: '3–20 characters, lowercase letters, numbers and underscores.',
      })
      return
    }

    let cancelled = false
    setState({ status: 'checking' })
    supabase
      .rpc('check_username', { name: value })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setState({ status: 'error' })
        else setState({ status: data ? 'available' : 'taken' })
      })

    return () => {
      cancelled = true
    }
  }, [value])

  return state
}
