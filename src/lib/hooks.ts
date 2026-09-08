import { useEffect, useRef, useState } from 'react'

/** Stable interval that respects a null delay (paused). */
export function useInterval(callback: () => void, delay: number | null): void {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => saved.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Seconds remaining until `until` (epoch ms). 0 when elapsed or unset. */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), until === null ? null : 250)
  if (until === null) return 0
  return Math.max(0, Math.ceil((until - now) / 1000))
}
