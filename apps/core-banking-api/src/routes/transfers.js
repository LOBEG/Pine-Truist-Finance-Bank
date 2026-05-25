import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import {
  internalTransferBodySchema,
  achTransferBodySchema,
  wireTransferBodySchema,
} from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { postTransaction } from '@pine/lib-ledger';
import { encryptField } from '@pine/lib-crypto';
import { consumePin } from '../services/pin.js';
import { writeAudit } from '../services/identity.js';
import { getExternalClearingAccount } from '../services/clearing.js';

function getIdempotencyKey(req) {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string' || key.length < 8) {
    throw errors.badRequest('idempotency_required', 'Idempotency-Key header required.');
  }
  return key.slice(0, 128);
}

async function assertAccountOwnership(userId, accountId) {
  const { rows } = await query(`SELECT id, status FROM accounts WHERE id = $1 AND user_id = $2`, [
    accountId,
    userId,
  ]);
  if (!rows[0]) throw errors.notFound('account_not_found');
  if (rows[0].status !== 'active')
    throw errors.conflict('account_inactive', 'Source account not active.');
  return rows[0];
}

export function buildTransfersRouter({ publish, kekB64 }) {
  const router = Router();

  // -------- Internal transfer --------
  router.post(
    '/internal',
    validate({ body: internalTransferBodySchema }),
    asyncHandler(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req);
      const { sourceAccountId, destinationAccountId, amount, memo, pin } = req.body;
      if (sourceAccountId === destinationAccountId)
        throw errors.badRequest('same_account', 'Source and destination must differ.');

      await assertAccountOwnership(req.user.id, sourceAccountId);
      // Destination may belong to the same user or another user — both OK.
      const dest = await query(`SELECT status FROM accounts WHERE id = $1`, [destinationAccountId]);
      if (!dest.rows[0]) throw errors.notFound('destination_not_found');
      if (dest.rows[0].status !== 'active')
        throw errors.conflict('destination_inactive', 'Destination account not active.');

      const { pinId } = await consumePin({
        userId: req.user.id,
        purpose: 'internal_transfer',
        plaintextPin: pin,
      });

      const result = await postTransaction({
        type: 'internal_transfer',
        status: 'posted',
        idempotencyKey,
        amount,
        memo,
        description: 'Internal transfer',
        sourceAccountId,
        destinationAccountId,
        initiatedByUserId: req.user.id,
        pinAuthorizationId: pinId,
        entries: [
          { accountId: sourceAccountId, direction: 'debit', amount },
          { accountId: destinationAccountId, direction: 'credit', amount },
        ],
      });

      await writeAudit({
        actorUserId: req.user.id,
        action: 'transfer.internal.posted',
        resourceType: 'transaction',
        resourceId: result.transactionId,
        after: { amount, sourceAccountId, destinationAccountId },
        ip: req.ip,
        requestId: req.id,
      });
      await publish('transaction.posted', {
        transactionId: result.transactionId,
        type: 'internal_transfer',
        userId: req.user.id,
        sourceAccountId,
        destinationAccountId,
        amount,
      });

      res.status(201).json({ transactionId: result.transactionId, status: result.status });
    }),
  );

  // -------- ACH transfer (debits queue ACH outbound) --------
  router.post(
    '/ach',
    validate({ body: achTransferBodySchema }),
    asyncHandler(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req);
      const {
        sourceAccountId,
        counterpartyId,
        amount,
        secCode,
        direction,
        effectiveDate,
        memo,
        pin,
      } = req.body;

      await assertAccountOwnership(req.user.id, sourceAccountId);
      const cp = await query(
        `SELECT id, name FROM counterparties WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [counterpartyId, req.user.id],
      );
      if (!cp.rows[0]) throw errors.notFound('counterparty_not_found');

      const { pinId } = await consumePin({
        userId: req.user.id,
        purpose: 'ach_transfer',
        plaintextPin: pin,
      });

      // Two pending legs (balanced): customer side + external clearing.
      // For ACH credit (sending money out): debit customer, credit clearing.
      // For ACH debit (pulling money in):   credit customer, debit clearing.
      const clearingId = await getExternalClearingAccount(kekB64);
      const customerDir = direction === 'debit' ? 'credit' : 'debit';
      const clearingDir = direction === 'debit' ? 'debit' : 'credit';
      const result = await postTransaction({
        type: direction === 'debit' ? 'ach_debit' : 'ach_credit',
        status: 'pending',
        idempotencyKey,
        amount,
        memo,
        description: `ACH ${direction} — ${cp.rows[0].name}`,
        sourceAccountId,
        counterpartyId,
        initiatedByUserId: req.user.id,
        pinAuthorizationId: pinId,
        entries: [
          { accountId: sourceAccountId, direction: customerDir, amount, status: 'pending' },
          { accountId: clearingId, direction: clearingDir, amount, status: 'pending' },
        ],
      });

      await query(
        `INSERT INTO ach_transfers
           (transaction_id, counterparty_id, sec_code, direction, effective_date, settlement_status)
         VALUES ($1, $2, $3, $4, $5::date, 'initiated')`,
        [result.transactionId, counterpartyId, secCode, direction, effectiveDate],
      );

      await writeAudit({
        actorUserId: req.user.id,
        action: 'transfer.ach.initiated',
        resourceType: 'transaction',
        resourceId: result.transactionId,
        after: { amount, direction, counterpartyId, effectiveDate },
        ip: req.ip,
        requestId: req.id,
      });
      await publish('transaction.created', {
        transactionId: result.transactionId,
        type: `ach_${direction}`,
        userId: req.user.id,
        amount,
      });

      res.status(202).json({ transactionId: result.transactionId, status: 'pending' });
    }),
  );

  // -------- Wire transfer (domestic) --------
  router.post(
    '/wire/domestic',
    validate({ body: wireTransferBodySchema }),
    asyncHandler(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req);
      const { sourceAccountId, amount, reference, pin, beneficiary } = req.body;

      await assertAccountOwnership(req.user.id, sourceAccountId);
      const { pinId } = await consumePin({
        userId: req.user.id,
        purpose: 'wire_transfer',
        plaintextPin: pin,
      });

      const wireReviewSetting = await query(
        `SELECT value FROM system_settings WHERE key = 'fraud.wire.review_threshold'`,
      );
      const reviewThreshold = Number(JSON.parse(wireReviewSetting.rows[0]?.value || '"25000.00"'));
      const initialStatus = Number(amount) >= reviewThreshold ? 'pending_review' : 'pending';

      const clearingId2 = await getExternalClearingAccount(kekB64);
      const result = await postTransaction({
        type: 'wire_domestic',
        status: initialStatus,
        idempotencyKey,
        amount,
        memo: reference,
        description: `Wire to ${beneficiary.name}`,
        sourceAccountId,
        initiatedByUserId: req.user.id,
        pinAuthorizationId: pinId,
        entries: [
          { accountId: sourceAccountId, direction: 'debit', amount, status: 'pending' },
          { accountId: clearingId2, direction: 'credit', amount, status: 'pending' },
        ],
      });

      await query(
        `INSERT INTO wire_transfers
           (transaction_id, beneficiary_name, beneficiary_address, beneficiary_bank,
            beneficiary_routing, beneficiary_account_enc, reference, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'initiated')`,
        [
          result.transactionId,
          beneficiary.name,
          beneficiary.address || null,
          beneficiary.bankName,
          beneficiary.routingNumber,
          encryptField(beneficiary.accountNumber, kekB64),
          reference || null,
        ],
      );

      await writeAudit({
        actorUserId: req.user.id,
        action: 'transfer.wire.initiated',
        resourceType: 'transaction',
        resourceId: result.transactionId,
        after: { amount, beneficiary: { name: beneficiary.name, bankName: beneficiary.bankName } },
        ip: req.ip,
        requestId: req.id,
      });

      const topic =
        initialStatus === 'pending_review' ? 'transaction.flagged' : 'transaction.created';
      await publish(topic, {
        transactionId: result.transactionId,
        type: 'wire_domestic',
        userId: req.user.id,
        amount,
      });

      res.status(202).json({ transactionId: result.transactionId, status: initialStatus });
    }),
  );

  return router;
}
