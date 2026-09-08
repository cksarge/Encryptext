import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { buttonClass } from '@/components/ui/primitives'
import { Logo } from '@/components/Logo'
import { GithubMark } from '@/components/icons/GithubMark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { GITHUB_URL } from '@/lib/site'

export function SiteHeader() {
  const { user, loading } = useAuth()

  return (
    <header className="sticky top-0 z-10 border-b border-border glass">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link to="/" className="text-lg">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1.5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            title="View source on GitHub"
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            <GithubMark className="size-4" />
          </a>
          <ThemeToggle />
          {loading ? null : user ? (
            <Link to="/app" className={buttonClass('primary', 'sm')}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth?mode=login"
                className={buttonClass('ghost', 'sm')}
              >
                Log in
              </Link>
              <Link
                to="/auth?mode=signup"
                className={buttonClass('primary', 'sm')}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
