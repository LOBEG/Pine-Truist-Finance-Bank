#!/usr/bin/env node
/**
 * Generate fresh RS256 JWT keypair + 32-byte KEK + refresh-token pepper, all
 * base64-encoded for paste into Railway service variables.
 *
 * Usage: node scripts/rotate-keys.js
 *
 * After updating Railway secrets, redeploy all services. Old refresh tokens
 * remain valid until expiry (their lookup hash uses the *old* pepper); if you
 * need to invalidate all sessions, run:
 *   UPDATE sessions SET revoked_at = now(), revoked_reason = 'key_rotation';
 */
import crypto from 'node:crypto';

function genRsa() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    JWT_PRIVATE_KEY_B64: Buffer.from(privateKey).toString('base64'),
    JWT_PUBLIC_KEY_B64: Buffer.from(publicKey).toString('base64'),
  };
}

const keys = genRsa();
const kek = crypto.randomBytes(32).toString('base64');
const pepper = crypto.randomBytes(32).toString('base64');

const env = {
  ...keys,
  ENCRYPTION_KEK_B64: kek,
  REFRESH_TOKEN_PEPPER: pepper,
};

for (const [k, v] of Object.entries(env)) {
  console.info(`${k}=${v}`);
}
console.error('\n# Paste into Railway service variables for every Node service.');
