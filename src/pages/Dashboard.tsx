import { useEffect, useMemo, useState } from 'react'
import { Bell, LogOut, Plus, Settings } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  useConversations,
  type ConversationSummary,
} from '@/features/conversations'
import {
  notificationsPrompted,
  requestNotifications,
} from '@/features/notifications'
import { syncPush } from '@/features/push'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { Button, Spinner } from '@/components/ui/primitives'
import {
  ConversationList,
  RequestsSection,
} from '@/components/dashboard/ConversationList'
import { NewMessageModal } from '@/components/dashboard/NewMessageModal'
import { SettingsModal } from '@/components/dashboard/SettingsModal'
import { Thread } from '@/components/dashboard/Thread'

export function Dashboard() {
  const { profile, deviceReady, deviceError, retryDevice, signOut } = useAuth()
  const conversations = useConversations()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)

  const list = useMemo(
    () => conversations.data ?? [],
    [conversations.data],
  )
  const active = useMemo<ConversationSummary | null>(
    () => list.find((c) => c.id === activeId) ?? null,
    [list, activeId],
  )

  // One-time notification prompt, once the first request is accepted.
  useEffect(() => {
    const hasActive = list.some((c) => c.status === 'active')
    if (hasActive && !notificationsPrompted()) setShowNotifPrompt(true)
  }, [list])

  // Re-assert this device's push subscription (endpoints rotate). Never prompts.
  useEffect(() => {
    void syncPush()
  }, [])

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <a
          href="/app"
          className="rounded-md transition hover:opacity-80"
          title="Reload Encryptext"
        >
          <Logo />
        </a>
        <div className="relative flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="px-2"
          >
            <Settings className="size-4" />
          </Button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-muted"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {(profile?.display_name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{profile?.display_name}</span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-muted"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {showNotifPrompt && (
        <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-4 py-2 text-sm">
          <Bell className="size-4 shrink-0 text-primary" />
          <span className="flex-1">
            Get notified about new messages? We only ever show a name.
          </span>
          <Button
            size="sm"
            onClick={async () => {
              await requestNotifications()
              setShowNotifPrompt(false)
            }}
          >
            Enable
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNotifPrompt(false)}
          >
            Not now
          </Button>
        </div>
      )}

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[20rem_1fr]">
        <aside
          className={cn(
            'flex flex-col border-r border-border',
            active ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="flex items-center justify-between p-3">
            <h1 className="text-sm font-semibold">Conversations</h1>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : (
              <>
                <RequestsSection
                  conversations={list}
                  activeId={activeId}
                  onSelect={(c) => setActiveId(c.id)}
                />
                <ConversationList
                  conversations={list}
                  activeId={activeId}
                  onSelect={(c) => setActiveId(c.id)}
                />
              </>
            )}
          </div>
          {!deviceReady && deviceError ? (
            <div className="border-t border-border px-4 py-2 text-xs">
              <p className="text-danger">{deviceError}</p>
              <button
                onClick={retryDevice}
                className="mt-1 font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : !deviceReady ? (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Setting up this device’s keys…
            </p>
          ) : null}
        </aside>

        <main className={cn('min-w-0', active ? 'block' : 'hidden lg:block')}>
          {active && active.peer ? (
            <Thread
              key={active.id}
              conversation={active}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="max-w-sm">
                <Logo showText={false} className="mx-auto mb-4 scale-150" />
                <h2 className="text-lg font-medium">Pick a conversation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Or start a new one. Messages disappear 30 seconds after they’re
                  read.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewMessageModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onRequested={() => conversations.refetch()}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
