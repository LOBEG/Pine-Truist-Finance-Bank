import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginBodySchema } from '@pine/lib-validation';

test('login accepts either username or admin email identifier', () => {
  const byUsername = loginBodySchema.parse({
    username: 'customer_01',
    password: 'correct-horse-battery',
  });
  const byEmail = loginBodySchema.parse({
    username: 'admin@pinetruistfinance.com',
    password: 'correct-horse-battery',
  });

  assert.equal(byUsername.username, 'customer_01');
  assert.equal(byEmail.username, 'admin@pinetruistfinance.com');
});
