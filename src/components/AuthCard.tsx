import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { Copyright } from '@/components/Copyright'
import { ThemeToggle } from '@/components/ThemeToggle'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center text-lg">
          <Logo />
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
        <div className="mt-6 flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/security" className="hover:text-foreground">
              Security
            </Link>
          </div>
          <Copyright />
        </div>
      </div>
    </div>
  )
}
