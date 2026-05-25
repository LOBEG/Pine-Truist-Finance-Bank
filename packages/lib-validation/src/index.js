import { z } from 'zod';

export const uuid = z.string().uuid();

export const moneyAmount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), { message: 'Invalid amount.' })
  .refine((v) => Number(v) > 0, { message: 'Amount must be > 0.' });

export const email = z.string().email().max(254);
export const password = z.string().min(12).max(128);
export const pin6 = z.string().regex(/^\d{6}$/);

export const phoneE164 = z.string().regex(/^\+[1-9]\d{6,14}$/);
export const routingNumber = z.string().regex(/^\d{9}$/);
export const accountNumber = z.string().regex(/^\d{4,17}$/);

// --------------------- Auth ---------------------

export const registerBodySchema = z.object({
  email,
  password,
  fullName: z.string().min(2).max(120),
  phone: phoneE164.optional(),
});

export const loginBodySchema = z.object({
  email,
  password,
  mfaCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  deviceFingerprint: z.string().max(128).optional(),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export const mfaEnrollBodySchema = z.object({});

export const mfaVerifyBodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

// --------------------- Transfers ---------------------

export const internalTransferBodySchema = z.object({
  sourceAccountId: uuid,
  destinationAccountId: uuid,
  amount: moneyAmount,
  memo: z.string().max(140).optional(),
  pin: pin6,
});

export const achTransferBodySchema = z.object({
  sourceAccountId: uuid,
  counterpartyId: uuid,
  amount: moneyAmount,
  secCode: z.enum(['PPD', 'CCD', 'WEB']),
  direction: z.enum(['credit', 'debit']).default('credit'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().max(140).optional(),
  pin: pin6,
});

export const wireTransferBodySchema = z.object({
  sourceAccountId: uuid,
  amount: moneyAmount,
  reference: z.string().max(70).optional(),
  pin: pin6,
  beneficiary: z.object({
    name: z.string().min(1).max(120),
    address: z.string().max(200).optional(),
    bankName: z.string().max(120),
    routingNumber,
    accountNumber,
  }),
});

// --------------------- Counterparties ---------------------

export const counterpartyBodySchema = z.object({
  name: z.string().min(1).max(120),
  bankName: z.string().min(1).max(120),
  routingNumber,
  accountNumber,
  accountType: z.enum(['checking', 'savings']),
  country: z.string().length(2).default('US'),
});

// --------------------- Withdrawals ---------------------

export const withdrawalBodySchema = z.object({
  accountId: uuid,
  amount: moneyAmount,
  method: z.enum(['cash', 'check', 'ach_external', 'wire']),
  notes: z.string().max(280).optional(),
});

// --------------------- Admin ---------------------

export const adminPinBodySchema = z.object({
  purpose: z.enum(['internal_transfer', 'ach_transfer', 'wire_transfer', 'withdrawal', 'generic']),
  transactionId: uuid.optional(),
  expiresInMinutes: z.number().int().min(1).max(1440).default(30),
});

export const adminWithdrawalDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const transactionListQuerySchema = paginationQuerySchema.extend({
  accountId: uuid.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
});
