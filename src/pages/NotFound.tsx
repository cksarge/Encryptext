import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/primitives'
import { Logo } from '@/components/Logo'

export function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <Logo className="mx-auto mb-6 text-lg" />
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That link doesn’t go anywhere.
        </p>
        <Link to="/" className={buttonClass('secondary', 'md', 'mt-6')}>
          Back home
        </Link>
      </div>
    </div>
  )
}
