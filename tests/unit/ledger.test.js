/**
 * Smoke test: lib-ledger decimal math.
 * Run: node --test tests/unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUnits, fromUnits } from '@pine/lib-ledger';

test('toUnits parses common decimal values exactly', () => {
  assert.equal(toUnits('1').toString(), '10000');
  assert.equal(toUnits('1.5').toString(), '15000');
  assert.equal(toUnits('0.0001').toString(), '1');
  assert.equal(toUnits('1234567.8901').toString(), '12345678901');
});

test('fromUnits round-trips with 4-decimal precision', () => {
  assert.equal(fromUnits(toUnits('1234.5678')), '1234.5678');
  assert.equal(fromUnits(toUnits('0')), '0.0000');
  assert.equal(fromUnits(toUnits('999999.9999')), '999999.9999');
});

test('toUnits rejects invalid input', () => {
  assert.throws(() => toUnits('1.23456')); // > 4 dp
  assert.throws(() => toUnits('abc'));
  assert.throws(() => toUnits('1,000'));
});

test('toUnits handles negatives', () => {
  assert.equal(toUnits('-1.5').toString(), '-15000');
  assert.equal(fromUnits(toUnits('-1.5')), '-1.5000');
});
