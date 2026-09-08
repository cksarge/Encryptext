import { LegalDoc, type LegalSection } from '@/components/LegalDoc'

// DRAFT — prepared by the developer, not a lawyer. Review with qualified counsel
// before relying on it. Placeholders in [brackets] must be filled in.

const UPDATED = 'September 7, 2026'
const CONTACT = 'carterkasarjian@gmail.com'
const GOVERNING_LAW = 'the state of Arizona, USA'

const sections: LegalSection[] = [
  {
    heading: 'Acceptance of these Terms',
    paragraphs: [
      'Encryptext ("the Service") is provided by Carter Kasarjian ("we", "us", "the operator"). By creating an account, checking the acknowledgement boxes during sign-up, or using the Service, you agree to these Terms of Service ("Terms") and to the Privacy Policy, which is incorporated by reference. If you do not agree, do not use the Service.',
      'If you use the Service on behalf of an organization, you represent that you are authorized to bind that organization, and "you" refers to that organization.',
    ],
  },
  {
    heading: 'Eligibility',
    paragraphs: [
      'You must be at least 13 years old to use the Service, and at least the age of majority in your jurisdiction to agree to a binding contract. If you are between 13 and the age of majority, a parent or legal guardian must review and agree to these Terms on your behalf.',
      'You may not use the Service if you are barred from doing so under the laws of the United States or any other applicable jurisdiction.',
    ],
  },
  {
    heading: 'The Service, and what it does not guarantee',
    paragraphs: [
      'Encryptext lets registered users exchange end-to-end encrypted text messages in one-to-one conversations. Messages are encrypted on your device. The operator stores only ciphertext and public keys and cannot read your messages.',
      'Message deletion: a message is removed from our servers when the recipient opens it and has viewed it for 30 seconds (the countdown pauses while their tab is not visible), when the sender deletes it, or when it has gone unread for 24 hours — whichever comes first. Once opened, a message is in any case removed from our servers within roughly two minutes. This deletes only the server-side copy. It does not and cannot prevent a recipient from screenshotting, photographing, copying, or otherwise retaining a message, and it does not remove copies stored on any device.',
      'Key loss means data loss: encryption keys are generated on and stored only on your device. If you clear your browser storage, lose your device, or use a new device, past messages encrypted to the old device are permanently unrecoverable. There is no backup, no recovery mechanism, and no "master key". The operator cannot restore your messages or your keys under any circumstances.',
      'No delivery guarantee: the Service does not guarantee that any message will be delivered, delivered in order, delivered without delay, or delivered at all. An unread message is retained for at most 24 hours and is then deleted by automated maintenance, whether or not it was delivered.',
      'The Service may change, be suspended, or be discontinued at any time, with or without notice.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'You are responsible for the security of your account credentials, your device, your passkeys, and your browser profile. Anyone with access to your unlocked device may be able to read your messages.',
      'You must provide an accurate email address and keep it current. You are responsible for all activity that occurs under your account.',
      'Choose a username and display name that do not impersonate another person or entity and do not infringe anyone’s rights.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'You agree not to use the Service to: (a) violate any law or regulation; (b) send content that is unlawful, harassing, threatening, defamatory, or that infringes intellectual-property or privacy rights; (c) distribute malware or attempt to gain unauthorized access to the Service, its infrastructure, or other users’ accounts or data; (d) probe, scan, or test the vulnerability of the Service without prior written permission; (e) circumvent or interfere with rate limits, security, or authentication features, including the Cloudflare Turnstile challenge; (f) use automated means to create accounts or send messages at scale; or (g) resell, sublicense, or commercially exploit the Service without permission.',
      'Because messages are end-to-end encrypted, the operator does not and cannot monitor message content. Enforcement of this section is generally limited to account-level signals and to reports from conversation participants.',
    ],
  },
  {
    heading: 'Your content',
    paragraphs: [
      'You retain all rights to the content you send. You grant the operator only the limited, technical right to store and transmit the encrypted form of your content for the purpose of operating the Service.',
      'You are solely responsible for your content and for your interactions with other users. Conversations require mutual consent, and either participant may leave a conversation at any time, which deletes that conversation’s messages for both participants.',
    ],
  },
  {
    heading: 'Third-party services',
    paragraphs: [
      'The Service runs on infrastructure provided by third parties, including Supabase (database, authentication, realtime, and email delivery) and Cloudflare (the Turnstile anti-abuse challenge). Your use of the Service is also subject to those providers’ terms. The operator is not responsible for third-party services.',
    ],
  },
  {
    heading: 'Disclaimer of warranties',
    paragraphs: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT MESSAGES WILL BE DELIVERED, RETAINED, OR DELETED WITHIN ANY PARTICULAR TIME.',
      'No advice or information obtained from the Service creates any warranty not expressly stated in these Terms. The Service is not a substitute for a professionally audited secure-communications system, and no representation is made that it meets any specific regulatory, legal, or organizational security requirement.',
    ],
  },
  {
    heading: 'Limitation of liability',
    paragraphs: [
      'TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, MESSAGES, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF OR INABILITY TO USE THE SERVICE, INCLUDING LOSS OF MESSAGES OR KEYS, UNAUTHORIZED ACCESS TO YOUR DEVICE OR ACCOUNT, OR DISCLOSURE OF A MESSAGE BY A CONVERSATION PARTICIPANT.',
      'TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR’S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID THE OPERATOR FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM, OR (B) USD $100.',
      'Some jurisdictions do not allow certain limitations, so some of the above may not apply to you. In that case the limitations apply to the maximum extent permitted by law.',
    ],
  },
  {
    heading: 'Indemnification',
    paragraphs: [
      'You agree to indemnify, defend, and hold harmless the operator from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or connected with: your content; your use of the Service; your violation of these Terms; or your violation of any law or of the rights of any third party.',
    ],
  },
  {
    heading: 'Suspension and termination',
    paragraphs: [
      'You may stop using the Service and delete your account at any time. On account deletion, your profile, devices, keys, pending conversations, and any stored ciphertext associated with your account are deleted, subject to routine backups and legal retention obligations.',
      'The operator may suspend or terminate your access at any time, with or without notice, including for suspected violation of these Terms or to protect the Service or its users.',
    ],
  },
  {
    heading: 'Changes to these Terms',
    paragraphs: [
      'The operator may update these Terms from time to time. If a change is material, the operator will make reasonable efforts to provide notice (for example, in the app or by email). Changes take effect when posted, and your continued use of the Service after that constitutes acceptance.',
    ],
  },
  {
    heading: 'Governing law and disputes',
    paragraphs: [
      `These Terms are governed by the laws of ${GOVERNING_LAW}, without regard to conflict-of-laws rules. You and the operator agree to the exclusive jurisdiction of the courts located there for any dispute not subject to arbitration or small-claims court.`,
      'Any dispute must be brought within one year after it arises, or it is permanently barred, to the extent permitted by law.',
    ],
  },
  {
    heading: 'Miscellaneous',
    paragraphs: [
      'These Terms and the Privacy Policy are the entire agreement between you and the operator regarding the Service. If any provision is found unenforceable, the rest remains in effect. The operator’s failure to enforce a provision is not a waiver. You may not assign these Terms; the operator may assign them in connection with a merger, acquisition, or sale of assets.',
      `Questions about these Terms: ${CONTACT}.`,
    ],
  },
]

export function Terms() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={UPDATED}
      intro={
        <p>
          Please read these Terms carefully. They include a disclaimer of
          warranties, a limitation of liability, and an explanation of what
          Encryptext does and does not guarantee about encryption and message
          deletion.
        </p>
      }
      sections={sections}
    />
  )
}
