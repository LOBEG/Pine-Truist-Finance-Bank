import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  encryptField,
  decryptField,
  generateNumericPin,
  generateAccountNumber,
} from '@pine/lib-crypto';

test('argon2 password hash and verify', async () => {
  const hash = await hashPassword('correct-horse-battery-staple-99');
  assert.ok(await verifyPassword(hash, 'correct-horse-battery-staple-99'));
  assert.equal(await verifyPassword(hash, 'wrong'), false);
});

test('argon2 PIN hash and verify', async () => {
  const hash = await hashPin('123456');
  assert.ok(await verifyPin(hash, '123456'));
  assert.equal(await verifyPin(hash, '000000'), false);
});

test('AES-GCM envelope encryption round-trips', () => {
  const kek = Buffer.alloc(32, 7).toString('base64');
  const ct = encryptField('hello-world', kek);
  assert.notEqual(ct, 'hello-world');
  assert.equal(decryptField(ct, kek), 'hello-world');
});

test('encryptField produces distinct ciphertext per call (random IV)', () => {
  const kek = Buffer.alloc(32, 9).toString('base64');
  const a = encryptField('same', kek);
  const b = encryptField('same', kek);
  assert.notEqual(a, b);
});

test('generateNumericPin returns N digits', () => {
  for (let i = 0; i < 50; i += 1) {
    const p = generateNumericPin(6);
    assert.match(p, /^\d{6}$/);
  }
});

test('generateAccountNumber returns 12 digits starting with 1', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.match(generateAccountNumber(), /^1\d{11}$/);
  }
});
