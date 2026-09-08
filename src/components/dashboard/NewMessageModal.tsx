import { useState, type FormEvent } from 'react'
import { useRequestConversation } from '@/features/conversations'
import { isValidUsername, normalizeUsername } from '@/lib/utils'
import { Button, FieldError, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'

export function NewMessageModal({
  open,
  onClose,
  onRequested,
}: {
  open: boolean
  onClose: () => void
  onRequested: (conversationId: string) => void
}) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const request = useRequestConversation()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const name = normalizeUsername(username)
    if (!isValidUsername(name)) {
      setError('Enter a valid username (3–20 chars, a–z, 0–9, _).')
      return
    }
    try {
      const id = await request.mutateAsync(name)
      setUsername('')
      onRequested(id)
      onClose()
    } catch (err) {
      setError(
        err instanceof Error && /no user named/i.test(err.message)
          ? `No one is registered as @${name}.`
          : err instanceof Error
            ? err.message
            : 'Could not send that request.',
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      description="Send a request by username. You can only chat once they accept."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <Input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="pl-7"
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button
          type="submit"
          className="w-full"
          loading={request.isPending}
          disabled={!username.trim()}
        >
          Send request
        </Button>
      </form>
    </Modal>
  )
}
