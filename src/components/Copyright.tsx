import { cn } from '@/lib/utils'

/** Single source of truth for the copyright line. */
export const COPYRIGHT = '© 2026 Carter Kasarjian. All rights reserved.'

export function Copyright({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>{COPYRIGHT}</p>
  )
}
