import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const order = ['system', 'light', 'dark'] as const
const icons = { system: Monitor, light: Sun, dark: Moon }

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const Icon = icons[theme]

  return (
    <button
      type="button"
      aria-label={`Theme: ${theme}. Click to change.`}
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
      className={cn(
        'grid size-8 place-items-center rounded-md text-muted-foreground transition',
        'hover:bg-surface-muted hover:text-foreground',
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
