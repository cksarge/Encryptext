import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Fingerprint, Loader2, X } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { Button, FieldError, Input, Label } from '@/components/ui/primitives'
import {
  Turnstile,
  isTurnstileEnabled,
  resetTurnstile,
} from '@/components/Turnstile'
import { supabase } from '@/lib/supabase'
import { emailFlowsDisabled } from '@/lib/site'
import {
  cn,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  passwordChecks,
} from '@/lib/utils'
import {
  hasPasskey,
  loginWithPasskey,
  passkeyEmail,
} from '@/auth/passkey'
import { useUsernameAvailability } from '@/auth/useUsernameAvailability'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const mode: Mode = params.get('mode') === 'signup' ? 'signup' : 'login'

  const setMode = (next: Mode) =>
    navigate(`/auth?mode=${next}`, { replace: true })

  return (
    <AuthCard
      title={mode === 'signup' ? 'Create your account' : 'Welcome back'}
      subtitle={
        mode === 'signup'
          ? 'Email, a password, and a name to go by.'
          : 'Sign in to your conversations.'
      }
      footer={
        mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button
              className="text-primary hover:underline"
              onClick={() => setMode('login')}
            >
              Log in
            </button>
          </>
        ) : (
          <>
            New here?{' '}
            <button
              className="text-primary hover:underline"
              onClick={() => setMode('signup')}
            >
              Create an account
            </button>
          </>
        )
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1 text-sm">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'h-8 rounded-md font-medium transition',
              mode === m
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'login' ? 'Log in' : 'Sign up'}
          </button>
        ))}
      </div>

      {mode === 'login' ? <LoginForm /> : <SignupForm />}
    </AuthCard>
  )
}

function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'password' | 'passkey' | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const onCaptcha = useCallback((t: string | null) => setCaptcha(t), [])
  const captchaOk = !isTurnstileEnabled() || Boolean(captcha)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!captchaOk) return
    setError(null)
    setBusy('password')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: captcha ? { captchaToken: captcha } : undefined,
    })
    setBusy(null)
    // Turnstile tokens are single-use — clear it whatever the outcome.
    resetTurnstile()
    setCaptcha(null)
    if (!err) {
      navigate('/app', { replace: true })
      return
    }
    if (/confirm/i.test(err.message)) {
      navigate('/auth/confirm', { state: { email: email.trim() } })
      return
    }
    setError(err.message)
  }

  const onPasskey = async () => {
    setError(null)
    setBusy('passkey')
    try {
      await loginWithPasskey()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button
        type="submit"
        className="w-full"
        loading={busy === 'password'}
        disabled={!captchaOk}
      >
        Log in
      </Button>

      {hasPasskey() && (
        <>
          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-surface px-2">or</span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={busy === 'passkey'}
            onClick={onPasskey}
          >
            <Fingerprint className="size-4" />
            Sign in with a passkey
            {passkeyEmail() && (
              <span className="text-muted-foreground">({passkeyEmail()})</span>
            )}
          </Button>
        </>
      )}

      {!emailFlowsDisabled && (
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/auth/reset" className="hover:text-foreground">
            Forgot your password?
          </Link>
        </p>
      )}

      <Turnstile onToken={onCaptcha} />
    </form>
  )
}

function SignupForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const onCaptcha = useCallback((t: string | null) => setCaptcha(t), [])

  const usernameState = useUsernameAvailability(username)
  const passwordOk = isValidPassword(password)
  const captchaOk = !isTurnstileEnabled() || Boolean(captcha)
  const canSubmit =
    usernameState.status === 'available' &&
    passwordOk &&
    email.includes('@') &&
    displayName.trim().length > 0 &&
    agreeTerms &&
    agreePrivacy &&
    captchaOk &&
    !busy

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValidUsername(username) || !agreeTerms || !agreePrivacy || !captchaOk) {
      return
    }
    setError(null)
    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        captchaToken: captcha ?? undefined,
        data: {
          username: normalizeUsername(username),
          display_name: displayName.trim(),
        },
      },
    })
    setBusy(false)
    // Turnstile tokens are single-use — clear it whatever the outcome.
    resetTurnstile()
    setCaptcha(null)
    if (err) {
      setError(err.message)
      return
    }

    // Local testing: with email confirmation turned off in Supabase, sign-up
    // returns a session straight away — skip the 6-digit code screen entirely.
    const skipConfirm =
      import.meta.env.VITE_SKIP_EMAIL_CONFIRM === 'true' && Boolean(data.session)
    if (skipConfirm) {
      navigate('/app', { replace: true })
      return
    }

    navigate('/auth/confirm', {
      state: { email: email.trim(), verified: Boolean(data.session) },
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="su-email">Email</Label>
        <Input
          id="su-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="su-password">Password</Label>
        <Input
          id="su-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
        <PasswordRules password={password} />
      </div>

      <div>
        <Label htmlFor="su-username">Username</Label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <Input
            id="su-username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-7"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <UsernameHint state={usernameState} />
        </div>
      </div>

      <div>
        <Label htmlFor="su-display">Display name</Label>
        <Input
          id="su-display"
          required
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            I agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              className="text-primary hover:underline"
            >
              Terms of Service
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            I have read the{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>

      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" loading={busy} disabled={!canSubmit}>
        Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {emailFlowsDisabled
          ? 'You’ll be signed in right after this.'
          : 'We’ll email you a 6-digit code to confirm your address.'}
      </p>

      <Turnstile onToken={onCaptcha} />
    </form>
  )
}

const PASSWORD_RULES: { key: keyof ReturnType<typeof passwordChecks>; label: string }[] =
  [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'lower', label: 'A lowercase letter' },
    { key: 'upper', label: 'An uppercase letter' },
    { key: 'digit', label: 'A number' },
    { key: 'symbol', label: 'A symbol' },
  ]

function PasswordRules({ password }: { password: string }) {
  const checks = passwordChecks(password)
  const touched = password.length > 0
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {PASSWORD_RULES.map(({ key, label }) => {
        const met = checks[key]
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-1.5',
              met
                ? 'text-success'
                : touched
                  ? 'text-danger'
                  : 'text-muted-foreground',
            )}
          >
            {met ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <X className="size-3.5 shrink-0" />
            )}
            {label}
          </li>
        )
      })}
    </ul>
  )
}

function UsernameHint({
  state,
}: {
  state: ReturnType<typeof useUsernameAvailability>
}) {
  if (state.status === 'idle') return null
  const map = {
    checking: (
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    ),
    available: <Check className="size-4 text-success" />,
    taken: <X className="size-4 text-danger" />,
    invalid: <X className="size-4 text-danger" />,
    error: <X className="size-4 text-danger" />,
  } as const
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2">
      {map[state.status]}
    </span>
  )
}
