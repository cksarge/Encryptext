import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard } from '@/components/AuthCard'
import { Button, FieldError, Input } from '@/components/ui/primitives'
import { supabase } from '@/lib/supabase'

export function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=login`,
    })
    setBusy(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle={sent ? undefined : 'We’ll email you a reset link.'}
      footer={
        <Link to="/auth?mode=login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for {email}, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
