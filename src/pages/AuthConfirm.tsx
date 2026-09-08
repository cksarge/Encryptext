import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { Button, FieldError, Input } from '@/components/ui/primitives'
import { supabase } from '@/lib/supabase'
import { useCountdown } from '@/lib/hooks'
import { isPasskeySupported, registerPasskey } from '@/auth/passkey'

interface NavState {
  email?: string
  verified?: boolean
}

type Step = 'code' | 'passkey'

export function AuthConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as NavState

  const [email, setEmail] = useState(state.email ?? '')
  const [step, setStep] = useState<Step>(state.verified ? 'passkey' : 'code')

  if (!email) {
    return (
      <AuthCard
        title="Confirm your email"
        subtitle="Enter the address you signed up with."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
          }}
          className="space-y-4"
        >
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={!email.includes('@')}>
            Continue
          </Button>
        </form>
      </AuthCard>
    )
  }

  if (step === 'passkey') {
    return <SavePasskeyStep onDone={() => navigate('/app', { replace: true })} />
  }

  return (
    <CodeStep
      email={email}
      onVerified={async () => {
        setStep((await isPasskeySupported()) ? 'passkey' : 'code')
        if (!(await isPasskeySupported())) navigate('/app', { replace: true })
      }}
    />
  )
}

function CodeStep({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const resendIn = useCountdown(resendAt)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onVerified()
  }

  const resend = async () => {
    setError(null)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    if (err) setError(err.message)
    setResendAt(Date.now() + 60_000)
  }

  return (
    <AuthCard
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${email}.`}
      footer={
        <button
          className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
          onClick={resend}
          disabled={resendIn > 0}
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="text-center text-2xl tracking-[0.5em]"
        />
        <FieldError>{error}</FieldError>
        <Button
          type="submit"
          className="w-full"
          loading={busy}
          disabled={code.length !== 6}
        >
          Confirm email
        </Button>
      </form>
    </AuthCard>
  )
}

function SavePasskeyStep({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      await registerPasskey()
      onDone()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create a passkey.',
      )
      setBusy(false)
    }
  }

  return (
    <AuthCard
      title="Save a passkey?"
      subtitle="Skip the password next time you sign in on this device."
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Your passkey unlocks this browser with your fingerprint, face, or
            device PIN. It stays on this device — nothing extra is sent to the
            server.
          </p>
        </div>
        <FieldError>{error}</FieldError>
        <Button className="w-full" loading={busy} onClick={save}>
          <Fingerprint className="size-4" />
          Create passkey
        </Button>
        <Button variant="ghost" className="w-full" onClick={onDone} disabled={busy}>
          Maybe later
        </Button>
      </div>
    </AuthCard>
  )
}
