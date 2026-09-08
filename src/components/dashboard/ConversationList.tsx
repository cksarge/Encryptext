import { formatDistanceToNowStrict } from 'date-fns'
import { Check, Clock, X } from 'lucide-react'
import {
  useRespondToRequest,
  type ConversationSummary,
} from '@/features/conversations'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

interface Props {
  conversations: ConversationSummary[]
  activeId: string | null
  onSelect: (conversation: ConversationSummary) => void
}

export function RequestsSection({ conversations, onSelect }: Props) {
  const respond = useRespondToRequest()
  const incoming = conversations.filter(
    (c) => c.status === 'pending' && c.role === 'invitee',
  )
  const outgoing = conversations.filter(
    (c) => c.status === 'pending' && c.role === 'inviter',
  )

  if (incoming.length === 0 && outgoing.length === 0) return null

  return (
    <div className="border-b border-border px-2 py-3">
      <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Requests
      </p>
      {incoming.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {c.peer?.display_name ?? 'Someone'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{c.peer?.username} wants to connect
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="px-2"
            aria-label="Decline"
            loading={respond.isPending}
            onClick={() =>
              respond.mutate({ conversation: c.id, accept: false })
            }
          >
            <X className="size-4" />
          </Button>
          <Button
            size="sm"
            className="px-2"
            aria-label="Accept"
            loading={respond.isPending}
            onClick={() => {
              respond.mutate(
                { conversation: c.id, accept: true },
                { onSuccess: () => onSelect({ ...c, status: 'active' }) },
              )
            }}
          >
            <Check className="size-4" />
          </Button>
        </div>
      ))}
      {outgoing.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground"
        >
          <Clock className="size-4 shrink-0" />
          <span className="truncate">
            Waiting for @{c.peer?.username ?? '…'} to accept
          </span>
        </div>
      ))}
    </div>
  )
}

export function ConversationList({ conversations, activeId, onSelect }: Props) {
  const active = conversations.filter((c) => c.status === 'active')

  if (active.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No conversations yet. Start one with someone’s username.
      </p>
    )
  }

  return (
    <ul className="p-2">
      {active.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
              activeId === c.id ? 'bg-surface-muted' : 'hover:bg-surface-muted/60',
            )}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(c.peer?.display_name ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">
                  {c.peer?.display_name ?? 'Unknown'}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(c.lastActivityAt), {
                    addSuffix: false,
                  })}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                @{c.peer?.username ?? '…'}
              </p>
            </div>
            {c.unread > 0 && (
              <span className="size-2 shrink-0 rounded-full bg-primary" />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
