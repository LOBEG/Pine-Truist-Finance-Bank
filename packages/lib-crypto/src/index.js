import crypto from 'node:crypto';
import argon2 from 'argon2';

// --------------------- Argon2id ---------------------

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — OWASP recommendation as of 2024
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash, plain) {
  if (!hash || !plain) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function hashPin(pin) {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be 6 digits.');
  return argon2.hash(pin, ARGON2_OPTIONS);
}

export const verifyPin = verifyPassword;

// --------------------- Random / tokens ---------------------

export function generateNumericPin(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateAccountNumber() {
  // 12 random digits, prefixed '1' to avoid leading zeros
  let n = '1';
  for (let i = 0; i < 11; i += 1) n += crypto.randomInt(0, 10).toString();
  return n;
}

/**
 * SHA-256 lookup hash (NOT for passwords). Used for refresh-token lookup;
 * caller supplies a server-side pepper so an offline DB leak alone cannot
 * verify tokens.
 */
export function sha256Hex(value, pepper = '') {
  return crypto.createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

// --------------------- AES-256-GCM envelope encryption ---------------------
// On-disk format: base64( version(1) | iv(12) | tag(16) | wrappedDek(60) | ciphertext )
//   wrappedDek = AES-256-GCM(KEK).encrypt(DEK)  -> 12 iv + 16 tag + 32 key = 60 bytes
//
// KEK is 32 raw bytes derived from base64-decoded ENCRYPTION_KEK_B64.

const VERSION = 0x01;

function decodeKek(kekB64) {
  if (!kekB64) throw new Error('ENCRYPTION_KEK_B64 not configured.');
  const buf = Buffer.from(kekB64, 'base64');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEK_B64 must decode to exactly 32 bytes.');
  }
  return buf;
}

function gcmEncrypt(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ct };
}

function gcmDecrypt(key, iv, tag, ct) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptField(plaintext, kekB64) {
  if (plaintext === null || plaintext === undefined) return null;
  const kek = decodeKek(kekB64);
  const dek = crypto.randomBytes(32);
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');

  const { iv: dataIv, tag: dataTag, ct: dataCt } = gcmEncrypt(dek, pt);
  const { iv: kekIv, tag: kekTag, ct: wrappedDek } = gcmEncrypt(kek, dek);

  const wrapped = Buffer.concat([kekIv, kekTag, wrappedDek]); // 12 + 16 + 32 = 60
  const payload = Buffer.concat([Buffer.from([VERSION]), dataIv, dataTag, wrapped, dataCt]);
  return payload.toString('base64');
}

export function decryptField(encoded, kekB64) {
  if (encoded === null || encoded === undefined) return null;
  const kek = decodeKek(kekB64);
  const buf = Buffer.from(encoded, 'base64');
  const version = buf[0];
  if (version !== VERSION) throw new Error(`Unsupported ciphertext version: ${version}`);

  const dataIv = buf.subarray(1, 13);
  const dataTag = buf.subarray(13, 29);
  const wrapped = buf.subarray(29, 89);
  const dataCt = buf.subarray(89);

  const kekIv = wrapped.subarray(0, 12);
  const kekTag = wrapped.subarray(12, 28);
  const wrappedDek = wrapped.subarray(28, 60);

  const dek = gcmDecrypt(kek, kekIv, kekTag, wrappedDek);
  try {
    return gcmDecrypt(dek, dataIv, dataTag, dataCt).toString('utf8');
  } finally {
    dek.fill(0);
  }
}

export function constantTimeEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
