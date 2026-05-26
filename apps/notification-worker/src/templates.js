/**
 * Email/SMS/push template registry.
 * Provider integrations (Postmark, Twilio) are pluggable; in this build we
 * persist outbound messages to `notifications` table with status='sent' once
 * the provider returns success. Without a configured provider, we operate in
 * "log-only" mode for safe local development.
 */
export const TEMPLATES = {
  'transaction.posted': ({ amount, type }) =>
    `A transaction of $${amount} (${type}) has posted to your Pine Truist Finance Bank account.`,
  'transaction.flagged': ({ amount }) =>
    `Your $${amount} transaction is under review and will be released shortly.`,
  'withdrawal.requested': ({ amount }) =>
    `Your withdrawal request for $${amount} is pending review.`,
  'withdrawal.approved': ({ amount }) => `Your withdrawal of $${amount} has been approved.`,
  'withdrawal.rejected': ({ amount, reason }) =>
    `Your withdrawal of $${amount} was declined: ${reason}.`,
  'pin.issued': ({ purpose }) =>
    `A new ${purpose} PIN has been issued to you. Check your secure messages.`,
  'auth.login.succeeded': ({ ip }) =>
    `New sign-in to your Pine Truist Finance Bank account (IP ${ip || 'unknown'}).`,
};

export function renderTemplate(name, payload) {
  const fn = TEMPLATES[name];
  if (!fn) return `Notification: ${name}`;
  try {
    return fn(payload || {});
  } catch {
    return `Notification: ${name}`;
  }
}
