import { authenticator } from 'otplib';
import crypto from 'node:crypto';

authenticator.options = {
  step: 30,
  window: 1, // accept previous/current/next step to tolerate clock drift
  digits: 6,
};

export function generateMfaSecret() {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl({ secret, account, issuer = 'Pine Bank' }) {
  return authenticator.keyuri(account, issuer, secret);
}

export function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  try {
    return authenticator.check(String(token).replace(/\s+/g, ''), secret);
  } catch {
    return false;
  }
}

/** Generate N single-use backup codes (10 chars, base32). */
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(crypto.randomBytes(7).toString('base64url').slice(0, 10).toUpperCase());
  }
  return codes;
}
