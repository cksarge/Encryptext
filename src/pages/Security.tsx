import { Link } from 'react-router-dom'
import { SiteHeader } from '@/components/SiteHeader'
import { GithubMark } from '@/components/icons/GithubMark'
import { GITHUB_URL } from '@/lib/site'

const sections: { heading: string; body: string[] }[] = [
  {
    heading: 'What "end-to-end" means here',
    body: [
      'When you first message someone, each of your devices creates its own long-term key pair with libsodium/Olm. The private half is written only to this browser’s IndexedDB and is never uploaded.',
      'To start a conversation your device fetches the other device’s public keys and runs an X3DH-style handshake, then a Double Ratchet (the same construction Signal uses). Both sides independently arrive at the same message keys without ever transmitting them.',
      'Every message body is encrypted with a fresh ratchet key. Supabase stores the ciphertext and nothing else. There is no column, anywhere, that could hold plaintext.',
    ],
  },
  {
    heading: 'Why the operator cannot read your messages',
    body: [
      'The server never receives a private key. Decryption requires key material that exists only on the recipient’s device, so whoever runs the Supabase project — including us — cannot decrypt a stored message and has no instructions that would.',
      'Row Level Security additionally means one account can never read another account’s rows through the API.',
    ],
  },
  {
    heading: 'Self-destructing messages',
    body: [
      'A message is removed from Supabase in one of three situations: the recipient reads it and 30 seconds pass; the sender deletes it; or it has gone unread for 24 hours. Nothing else deletes messages.',
      'An unread message waits for you for up to 24 hours, then it is deleted whether or not it was ever delivered. Once read, your device deletes it after 30 seconds, and a database job that runs every 10 seconds is the backstop if that device goes offline mid-window.',
    ],
  },
  {
    heading: 'The limits, stated plainly',
    body: [
      'Deletion clears the server copy. It cannot stop the recipient taking a screenshot or keeping their own copy.',
      'Because keys live only on your device, clearing your browser storage or losing the device permanently destroys that message history. There is no backup by design.',
      'The server hands out public keys, so a malicious server could try to substitute one. Compare the safety number with your contact out of band to detect that.',
      'If the reading device goes offline the instant a message is read, the backstop sweep still removes it within about 40 seconds.',
    ],
  },
]

export function Security() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          How Encryptext keeps messages private
        </h1>
        <p className="mt-3 text-muted-foreground">
          The short version: your keys never leave your device, and read messages
          delete themselves.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <GithubMark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Encryptext is open source. Everything described below — the client,
            the crypto, and the database rules — is public. Read it at{' '}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              github.com/cksarge/Encryptext
            </a>
            .
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-medium">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((p) => (
                  <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/auth?mode=signup" className="text-primary hover:underline">
            Create an account →
          </Link>
        </div>
      </main>
    </div>
  )
}
