const TOTAL = 30

/**
 * Ring that drains over the 30 seconds a message is *viewed* after being read.
 * The parent owns the clock (it only decrements while the tab is visible), so
 * when `paused` the ring simply holds.
 */
export function CountdownRing({
  secondsLeft,
  paused = false,
}: {
  secondsLeft: number
  paused?: boolean
}) {
  const fraction = Math.min(1, Math.max(0, secondsLeft / TOTAL))
  const radius = 7
  const circumference = 2 * Math.PI * radius

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground"
      title={
        paused
          ? `Paused — disappears ${secondsLeft}s after you look at it`
          : `Disappears in ${secondsLeft}s`
      }
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
          className={
            paused
              ? 'text-muted-foreground'
              : 'text-primary transition-[stroke-dashoffset] duration-250 ease-linear'
          }
        />
      </svg>
      {paused ? 'paused' : `${secondsLeft}s`}
    </span>
  )
}
