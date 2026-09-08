import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Lock className="size-4" />
      </span>
      {showText && (
        <span className="tracking-tight">
          Encrypt<span className="text-primary">ext</span>
        </span>
      )}
    </span>
  )
}
