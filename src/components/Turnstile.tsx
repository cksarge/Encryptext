import { useEffect, useRef, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      theme?: 'auto' | 'light' | 'dark'
      retry?: 'auto' | 'never'
      callback: (token: string) => void
      'error-callback'?: (code?: string) => void
      'expired-callback'?: () => void
    },
  ) => string
  remove: (id: string) => void
  reset: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed to load'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** True when a site key is configured; forms then require a token to submit. */
export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY)
}

/**
 * Turnstile tokens are single-use. Call this after every auth attempt so the
 * next submit gets a fresh token.
 */
export function resetTurnstile(): void {
  try {
    window.turnstile?.reset()
  } catch {
    /* widget not mounted */
  }
}

/**
 * Renders the Cloudflare Turnstile widget at the bottom of an auth form. Reports
 * the token (or null when it errors/expires) via `onToken`. Renders nothing
 * until `VITE_TURNSTILE_SITE_KEY` is set.
 */
export function Turnstile({
  onToken,
}: {
  onToken: (token: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const reportRef = useRef(onToken)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    reportRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    const report = (token: string | null) => reportRef.current(token)

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        try {
          widgetId.current = window.turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            theme: 'auto',
            retry: 'auto',
            callback: (token) => {
              setErrorCode(null)
              report(token)
            },
            'error-callback': (code) => {
              // eslint-disable-next-line no-console
              console.error('[Turnstile] error', code, 'on', window.location.hostname)
              setErrorCode(code ?? 'unknown')
              report(null)
            },
            'expired-callback': () => report(null),
          })
        } catch (err) {
          console.error('[Turnstile] render threw', err)
          setErrorCode('render-failed')
          report(null)
        }
      })
      .catch((err) => {
        console.error('[Turnstile]', err)
        setErrorCode('script-blocked')
        report(null)
      })

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          /* already gone */
        }
        widgetId.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null
  return (
    <div className="mt-2 flex flex-col items-center gap-1">
      <div
        ref={containerRef}
        className="flex min-h-[65px] justify-center"
        aria-label="Cloudflare Turnstile challenge"
      />
      {errorCode && (
        <p className="text-center text-xs text-danger">
          Turnstile error <code>{errorCode}</code>. Check the browser console for
          details.
        </p>
      )}
    </div>
  )
}
