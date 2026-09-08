import { Link } from 'react-router-dom'
import { ArrowRight, Eye, KeyRound, ServerOff, Timer } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { SiteHeader } from '@/components/SiteHeader'
import { Logo } from '@/components/Logo'
import { Copyright } from '@/components/Copyright'
import { GithubMark } from '@/components/icons/GithubMark'
import { buttonClass } from '@/components/ui/primitives'
import { GITHUB_URL } from '@/lib/site'

const points = [
  {
    icon: KeyRound,
    title: 'Your device holds the keys',
    body: 'Each device generates its own keys and derives a matching shared secret with the person you are talking to. The secret is never sent anywhere.',
  },
  {
    icon: ServerOff,
    title: 'The server can’t read a thing',
    body: 'Supabase only ever stores scrambled text and public keys. There is no private key on the server, so the operator cannot decrypt your messages — there is no switch to flip.',
  },
  {
    icon: Timer,
    title: 'Messages don’t linger',
    body: 'Thirty seconds after you read a message it is deleted from the server. The sender can delete anytime. Anything still unread is wiped after 24 hours.',
  },
  {
    icon: Eye,
    title: 'Honest about the limits',
    body: 'Deletion clears the server copy, not screenshots. Lose your device and that history is gone — there is no backup and no backdoor.',
  },
]

export function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-5">
        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <GithubMark className="size-3.5" />
            Open source · end-to-end encrypted · self-destructing
          </a>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Messages only the two of you can read.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Encryptext encrypts every message on your device with a key that
            never leaves it, then wipes the server copy 30 seconds after it’s
            read.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? '/app' : '/auth?mode=signup'}
              className={buttonClass('primary', 'lg')}
            >
              {user ? 'Open Encryptext' : 'Get started'}{' '}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/security"
              className={buttonClass('secondary', 'lg')}
            >
              How it stays private
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {points.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <Icon className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </section>

        <section className="my-16 flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-10 text-center">
          <GithubMark className="size-6 text-foreground" />
          <h2 className="text-xl font-medium">Encryptext is fully open source</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Don’t take our word for the encryption — read every line. Audit the
            crypto, open an issue, or fork it. The entire app and database schema
            are public.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'md')}
          >
            <GithubMark className="size-4" /> View source on GitHub
          </a>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo />
            <Copyright />
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
            <Link to="/security" className="hover:text-foreground">
              Security
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link
              to={user ? '/app' : '/auth?mode=login'}
              className="hover:text-foreground"
            >
              {user ? 'Dashboard' : 'Log in'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
