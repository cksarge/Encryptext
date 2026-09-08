import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Laptop, Trash2 } from 'lucide-react'
import { currentDevice, forgetThisDevice } from '@/crypto'
import { useAuth } from '@/auth/AuthProvider'
import { useMyDevices, useRevokeDevice } from '@/features/devices'
import {
  notificationsEnabled,
  notificationsSupported,
  requestNotifications,
  setNotificationsPreference,
} from '@/features/notifications'
import {
  clearPasskey,
  hasPasskey,
  isPasskeySupported,
  passkeyEmail,
  registerPasskey,
} from '@/auth/passkey'
import { disablePush, enablePush, pushEnabled, pushSupported } from '@/features/push'
import { Button } from '@/components/ui/primitives'
import { Copyright } from '@/components/Copyright'
import { Modal } from '@/components/ui/Modal'
import { GITHUB_URL } from '@/lib/site'

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { profile } = useAuth()
  const devices = useMyDevices()
  const revoke = useRevokeDevice()
  const thisDeviceId = currentDevice()?.deviceId

  // Always show at least this device, even if the server list is slow/failed.
  const serverDevices = devices.data ?? []
  const deviceRows: { id: string; label: string; synthetic: boolean }[] = [
    ...(thisDeviceId && !serverDevices.some((d) => d.id === thisDeviceId)
      ? [{ id: thisDeviceId, label: 'This device', synthetic: true }]
      : []),
    ...serverDevices.map((d) => ({
      id: d.id,
      label: d.label,
      synthetic: false,
    })),
  ]

  const [notifOn, setNotifOn] = useState(notificationsEnabled())
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeySaved, setPasskeySaved] = useState(hasPasskey())
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void isPasskeySupported().then(setPasskeySupported)
    void pushEnabled().then(setPushOn)
  }, [])

  const togglePush = async () => {
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        await enablePush()
        setPushOn(true)
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Could not change background notifications.',
      )
    } finally {
      setPushBusy(false)
    }
  }

  const addPasskey = () => {
    void registerPasskey()
      .then(() => setPasskeySaved(true))
      .catch(() => undefined)
  }

  const removePasskey = () => {
    if (
      confirm(
        'Remove the passkey from this device? You’ll sign in with your password.',
      )
    ) {
      clearPasskey()
      setPasskeySaved(false)
    }
  }

  const toggleNotifications = async () => {
    if (notifOn) {
      setNotificationsPreference(false)
      setNotifOn(false)
      void disablePush()
      setPushOn(false)
    } else {
      setNotifOn(await requestNotifications())
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="mb-1 font-medium">Account</h3>
          <p className="text-muted-foreground">
            {profile?.display_name}{' '}
            <span className="opacity-70">@{profile?.username}</span>
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-medium">Devices</h3>
          {deviceRows.length === 0 && devices.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading devices…</p>
          ) : deviceRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No devices found for this account yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {deviceRows.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <Laptop className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {d.label}
                      {d.id === thisDeviceId && (
                        <span className="ml-1 text-xs text-primary">
                          (this device)
                        </span>
                      )}
                    </p>
                  </div>
                  {d.id !== thisDeviceId && !d.synthetic && (
                    <button
                      className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Remove “${d.label}”? It won’t be able to send or read messages for this account again.`,
                          )
                        ) {
                          revoke.mutate(d.id)
                        }
                      }}
                    >
                      {revoke.isPending ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {revoke.isError && (
            <p className="mt-1 text-xs text-danger">
              {revoke.error instanceof Error
                ? revoke.error.message
                : 'Could not remove that device.'}
            </p>
          )}
          {devices.isError && (
            <p className="mt-1 text-xs text-danger">
              Couldn’t load the full device list.{' '}
              <button
                className="underline hover:no-underline"
                onClick={() => void devices.refetch()}
              >
                Retry
              </button>
            </p>
          )}
        </section>

        <section className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {notificationsSupported()
                ? 'A handle only — never message text.'
                : 'Not supported in this browser.'}
            </p>
          </div>
          <Button
            size="sm"
            variant={notifOn ? 'secondary' : 'primary'}
            disabled={!notificationsSupported()}
            onClick={toggleNotifications}
            className="group min-w-[5.25rem]"
          >
            {notifOn ? (
              <>
                <span className="group-hover:hidden">On</span>
                <span className="hidden group-hover:inline">Turn off?</span>
              </>
            ) : (
              <>
                <span className="group-hover:hidden">Off</span>
                <span className="hidden group-hover:inline">Turn on?</span>
              </>
            )}
          </Button>
        </section>

        {notifOn && pushSupported() && (
          <section className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Push notifications</h3>
              <p className="text-xs text-muted-foreground">
                Alerts on this device even when Encryptext is closed. Desktop
                Chrome, Edge, Firefox, Safari.
              </p>
            </div>
            <Button
              size="sm"
              variant={pushOn ? 'secondary' : 'primary'}
              loading={pushBusy}
              onClick={togglePush}
              className="group min-w-[5.25rem] shrink-0"
            >
              {pushOn ? (
                <>
                  <span className="group-hover:hidden">On</span>
                  <span className="hidden group-hover:inline">Turn off?</span>
                </>
              ) : (
                <>
                  <span className="group-hover:hidden">Off</span>
                  <span className="hidden group-hover:inline">Turn on?</span>
                </>
              )}
            </Button>
          </section>
        )}

        {passkeySupported && (
          <section className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Passkey</h3>
              <p className="truncate text-xs text-muted-foreground">
                {passkeySaved
                  ? `Saved for ${passkeyEmail() ?? 'this account'} on this device.`
                  : 'Sign in without a password on this device.'}
              </p>
            </div>
            {passkeySaved ? (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 text-danger"
                onClick={removePasskey}
              >
                Remove
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={addPasskey}
              >
                Add
              </Button>
            )}
          </section>
        )}

        <section className="rounded-lg border border-danger/40 p-3">
          <h3 className="flex items-center gap-2 font-medium text-danger">
            <Trash2 className="size-4" /> Forget this device
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Deletes this browser’s keys. Any message history encrypted to it
            becomes permanently unreadable. You’ll re-enroll on next sign-in.
          </p>
          <Button
            size="sm"
            variant="danger"
            className="mt-2"
            onClick={() => {
              if (confirm('Forget this device? Message history on it will be unrecoverable.')) {
                void forgetThisDevice().then(() => window.location.reload())
              }
            }}
          >
            Forget device
          </Button>
        </section>

        <div className="flex flex-col items-center gap-1.5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/security" target="_blank" className="hover:text-foreground">
              Security
            </Link>
            <Link to="/terms" target="_blank" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" target="_blank" className="hover:text-foreground">
              Privacy
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Source
            </a>
          </div>
          <Copyright />
        </div>
      </div>
    </Modal>
  )
}
