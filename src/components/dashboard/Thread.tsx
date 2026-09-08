import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ArrowLeft, MoreVertical, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { safetyNumberWith } from '@/crypto'
import { useAuth } from '@/auth/AuthProvider'
import { useThread, type ThreadMessage } from '@/features/messages'
import { useLeaveConversation } from '@/features/conversations'
import { notify } from '@/features/notifications'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { CountdownRing } from './CountdownRing'
import type { ConversationSummary } from '@/features/conversations'

export function Thread({
  conversation,
  onBack,
}: {
  conversation: ConversationSummary
  onBack: () => void
}) {
  const { user } = useAuth()
  const peer = conversation.peer
  const { messages, ready, send, readCountdowns, viewing } = useThread(
    conversation.id,
    peer?.id ?? '',
  )
  const leave = useLeaveConversation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set<string>())

  const ended = conversation.status === 'ended'

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Foreground notification for messages that arrive from the peer.
  useEffect(() => {
    for (const m of messages) {
      if (seenIds.current.has(m.id)) continue
      seenIds.current.add(m.id)
      if (!m.mine && m.status === 'ok') {
        notify('Encryptext', `New message from @${peer?.username ?? 'someone'}`)
      }
    }
  }, [messages, peer])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted lg:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{peer?.display_name ?? 'Unknown'}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{peer?.username ?? '…'}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted"
            aria-label="Conversation menu"
          >
            <MoreVertical className="size-5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-muted"
                onClick={() => {
                  setSafetyOpen(true)
                  setMenuOpen(false)
                }}
              >
                <ShieldCheck className="size-4" /> Safety number
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-surface-muted"
                onClick={() => {
                  setMenuOpen(false)
                  if (confirm('Leave this conversation? Every message in it is deleted for both of you.')) {
                    leave.mutate(conversation.id)
                  }
                }}
              >
                <Trash2 className="size-4" /> Leave conversation
              </button>
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {ended ? (
          <EmptyNote>
            {conversation.endedBy && conversation.endedBy !== user?.id
              ? `${peer?.display_name ?? 'They'} left the conversation.`
              : 'This conversation has ended.'}
          </EmptyNote>
        ) : !ready ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : messages.length === 0 ? (
          <EmptyNote>
            No messages yet. Say something — it disappears 30 seconds after they
            read it.
          </EmptyNote>
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              message={m}
              secondsLeft={readCountdowns[m.id]}
              paused={!viewing}
            />
          ))
        )}
      </div>

      {!ended && <Composer onSend={send} />}

      <SafetyNumberModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        peerUserId={peer?.id ?? ''}
        peerName={peer?.display_name ?? 'your contact'}
      />
    </div>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
      <p className="max-w-xs">{children}</p>
    </div>
  )
}

function Bubble({
  message,
  secondsLeft,
  paused,
}: {
  message: ThreadMessage
  secondsLeft: number | undefined
  paused: boolean
}) {
  const mine = message.mine
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] animate-fade-in rounded-2xl px-3.5 py-2 text-sm',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-surface-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.status === 'unavailable' ? (
          <span className="italic opacity-70">
            {mine ? 'Sent from another device' : 'Message unavailable'}
          </span>
        ) : message.status === 'pending' ? (
          <span className="opacity-60">Decrypting…</span>
        ) : (
          <span className="whitespace-pre-wrap break-words">{message.text}</span>
        )}
        <div
          className={cn(
            'mt-1 flex items-center gap-2 text-[11px]',
            mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!mine && secondsLeft != null ? (
            <CountdownRing secondsLeft={secondsLeft} paused={paused} />
          ) : mine && message.firstReadAt ? (
            <span>Read</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Composer({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await onSend(text)
      setText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send that message.')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-border px-3 py-3"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Write a message"
        className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      />
      <Button type="submit" size="md" loading={busy} disabled={!text.trim()} className="px-3">
        <Send className="size-4" />
      </Button>
    </form>
  )
}

function SafetyNumberModal({
  open,
  onClose,
  peerUserId,
  peerName,
}: {
  open: boolean
  onClose: () => void
  peerUserId: string
  peerName: string
}) {
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    if (open && peerUserId) safetyNumberWith(peerUserId).then(setValue)
  }, [open, peerUserId])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Safety number"
      description={`Read this aloud with ${peerName}. If it matches on both devices, no one is in the middle.`}
    >
      <p className="rounded-lg bg-surface-muted p-4 text-center font-mono text-sm leading-relaxed tracking-wide">
        {value ?? 'Calculating…'}
      </p>
    </Modal>
  )
}
