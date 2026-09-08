/** Public repository — Encryptext is open source (Apache-2.0). */
export const GITHUB_URL = 'https://github.com/cksarge/Encryptext'

/**
 * When VITE_SKIP_EMAIL_CONFIRM is "true" there is no SMTP configured, so no
 * email is sent anywhere: sign-up skips the confirmation-code screen and
 * email-dependent flows (password reset) are hidden. Turn the env var off once
 * SMTP + email confirmation are set up.
 */
export const emailFlowsDisabled =
  import.meta.env.VITE_SKIP_EMAIL_CONFIRM === 'true'
