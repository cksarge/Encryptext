import { useCountdown } from '@/lib/hooks'

const TOTAL = 30

/** Small ring that drains over the 30s window after a message is read. */
export function CountdownRing({ expiresAt }: { expiresAt: string }) {
  const until = new Date(expiresAt).getTime()
  const secondsLeft = useCountdown(until)
  const fraction = Math.min(1, Math.max(0, secondsLeft / TOTAL))
  const radius = 7
  const circumference = 2 * Math.PI * radius

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground"
      title={`Disappears in ${secondsLeft}s`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90">
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.2"
        />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="text-primary transition-[stroke-dashoffset] duration-250 ease-linear"
        />
      </svg>
      {secondsLeft}s
    </span>
  )
}
