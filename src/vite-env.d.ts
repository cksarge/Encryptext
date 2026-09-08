/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Base64url VAPID public key. Only needed once background Web Push is enabled. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** Cloudflare Turnstile site key. When set, the widget shows on the auth pages. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /**
   * Local testing only. "true" makes sign-up skip the 6-digit email code screen
   * (pair with turning "Confirm email" OFF in Supabase). Remove once SMTP is set
   * up and email confirmation is back on.
   */
  readonly VITE_SKIP_EMAIL_CONFIRM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
