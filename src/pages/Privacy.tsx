import { LegalDoc, type LegalSection } from '@/components/LegalDoc'

// DRAFT — prepared by the developer, not a lawyer. Review with qualified counsel
// before relying on it. Placeholders in [brackets] must be filled in.

const UPDATED = 'September 7, 2026'
const CONTACT = 'carterkasarjian@gmail.com'

const sections: LegalSection[] = [
  {
    heading: 'Who is responsible for your data',
    paragraphs: [
      'Encryptext ("the Service") is operated by Carter Kasarjian ("we", "us", "the operator"). This Privacy Policy explains what we collect, why, how it is stored, and your choices. It applies only to the Service and not to any third-party site or service.',
    ],
  },
  {
    heading: 'What we cannot see',
    paragraphs: [
      'Encryptext is end-to-end encrypted. Your private keys are generated on your device and never sent to us. We store only ciphertext (scrambled message data) and public keys. We cannot read your messages, and we have no mechanism, key, or "back door" that would let us or anyone else decrypt them on our servers.',
      'Message metadata we can see is limited to what is technically required to route and expire messages: which conversation a message belongs to, which device sent it, which devices it is addressed to, timestamps, and read/expiry status.',
    ],
  },
  {
    heading: 'Information you provide',
    paragraphs: [
      'Account: your email address, a chosen username, and a display name. Email is used for authentication, the 6-digit confirmation code, password resets, and essential service notices.',
      'Encryption material: the public keys and one-time pre-keys your devices publish so others can start encrypted sessions with you, plus a short device label (e.g. "Chrome on macOS") that you can rename.',
      'Message content: only in encrypted form, and only until it is deleted under the rules below.',
      'Optional push subscription: if you later enable background notifications, the browser push endpoint and its keys. Not collected unless you opt in.',
    ],
  },
  {
    heading: 'Information collected automatically',
    paragraphs: [
      'Local storage on your device: your encryption keys, session state, decrypted copies of messages you have received or sent, and preferences such as theme and notification choice are stored in your browser (IndexedDB and localStorage). This data stays on your device and is not transmitted to us.',
      'Server logs: our infrastructure providers process standard technical data such as IP address, timestamp, and request metadata for security, abuse prevention, and reliability. We do not use tracking or advertising cookies and do not run third-party analytics or ad networks.',
      'Anti-abuse: if the Cloudflare Turnstile challenge is enabled, Cloudflare processes limited technical signals from your browser to distinguish humans from bots. See Cloudflare’s privacy documentation.',
    ],
  },
  {
    heading: 'How message deletion works',
    paragraphs: [
      'A message is deleted from our servers when the recipient reads it and 30 seconds pass, or when the sender deletes it. A maintenance job running every 10 seconds removes any already-read message that was not cleared by the sending or receiving device in time.',
      'An unread message is retained until it is read, the sender deletes it, or 24 hours pass — whichever comes first. After 24 hours it is deleted whether or not it was delivered.',
      'Deletion removes the server-side copy only. Decrypted copies on participants’ devices, screenshots, and forwarded content are outside our control.',
    ],
  },
  {
    heading: 'How long we keep other data',
    paragraphs: [
      'Account data (email, username, display name), device records, and public keys are retained while your account is active. When you delete your account, this data is deleted, and any remaining ciphertext addressed to your account is deleted, subject to short-lived provider backups and any retention we are legally required to maintain.',
      'Server logs held by our providers are retained for a limited period per their policies.',
    ],
  },
  {
    heading: 'Legal bases and purposes',
    paragraphs: [
      'Where the GDPR or similar laws apply, we process your data to perform our contract with you (providing the Service), for our legitimate interests (security, abuse prevention, keeping the Service running), and to comply with legal obligations. Where required, we rely on your consent (for example, optional push notifications), which you can withdraw at any time.',
    ],
  },
  {
    heading: 'Sharing',
    paragraphs: [
      'We do not sell your personal information and do not share it for advertising. We share data only with service providers that host and operate the Service on our behalf, currently Supabase (database, authentication, realtime, transactional email) and Cloudflare (Turnstile). These providers process data under their own terms and only to provide their services to us.',
      'We may disclose data if required by valid legal process, to enforce our Terms, or to protect the rights, safety, or property of users or the public. Because message content is end-to-end encrypted, we cannot produce readable message content in response to such requests.',
    ],
  },
  {
    heading: 'International transfers',
    paragraphs: [
      'Our providers may process and store data in the United States and other countries. Where required, transfers rely on appropriate safeguards such as standard contractual clauses.',
    ],
  },
  {
    heading: 'Your choices and rights',
    paragraphs: [
      'You can update your display name, rename or revoke devices, leave conversations, and delete your account from within the app. Depending on your location, you may have rights to access, correct, delete, port, or restrict processing of your personal data, and to object to certain processing.',
      `To make a request, contact ${CONTACT}. We may need to verify your identity. Note that we cannot recover or provide message content or encryption keys, because we do not have access to them.`,
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'We use end-to-end encryption, Row Level Security on the database, and transport encryption. No system is perfectly secure. You are responsible for securing your device, browser profile, credentials, and passkeys. If we become aware of a breach affecting your data, we will notify you as required by law.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'The Service is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has provided us information, contact us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to this Policy',
    paragraphs: [
      'We may update this Policy from time to time. If a change is material, we will make reasonable efforts to notify you in the app or by email. The "Last updated" date above reflects the current version.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [`Questions or requests: ${CONTACT}.`],
  },
]

export function Privacy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <p>
          The short version: your messages are end-to-end encrypted and we cannot
          read them; we collect the minimum needed to run accounts and route
          encrypted messages; we don’t sell data or run ad trackers.
        </p>
      }
      sections={sections}
    />
  )
}
