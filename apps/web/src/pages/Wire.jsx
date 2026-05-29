import { useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { formatMoney } from '../api/format.js';
import { PinModal } from '../components/PinModal.jsx';
import { AccountSelect, Alert, AmountInput, Field, SubmitButton } from '../components/ui.jsx';
import { useMutation } from '../hooks/useMutation.js';

const EMPTY_BENEFICIARY = {
  name: '',
  bankName: '',
  routingNumber: '',
  accountNumber: '',
  address: '',
};

/**
 * WirePanel — domestic Fedwire form. Embeddable in the Move Money flow.
 */
export function WirePanel({ accounts }) {
  const [form, setForm] = useState({ sourceAccountId: '', amount: '', reference: '' });
  const [beneficiary, setBeneficiary] = useState(EMPTY_BENEFICIARY);
  const [pinOpen, setPinOpen] = useState(false);
  const { run, busy, error, result } = useMutation((body) =>
    api('/transfers/wire/domestic', {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
      body,
    }),
  );

  function updateForm(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateBeneficiary(k, v) {
    setBeneficiary((b) => ({ ...b, [k]: v }));
  }

  function handleSubmitRequest(e) {
    e.preventDefault();
    setPinOpen(true);
  }

  async function handlePinConfirm(pin) {
    setPinOpen(false);
    try {
      await run({
        sourceAccountId: form.sourceAccountId,
        amount: form.amount,
        reference: form.reference || undefined,
        pin,
        beneficiary: {
          name: beneficiary.name,
          bankName: beneficiary.bankName,
          routingNumber: beneficiary.routingNumber,
          accountNumber: beneficiary.accountNumber,
          address: beneficiary.address || undefined,
        },
      });
      setForm((f) => ({ ...f, amount: '', reference: '' }));
      setBeneficiary(EMPTY_BENEFICIARY);
    } catch {
      /* error surfaced via useMutation */
    }
  }

  const selectedAccount = accounts.find((a) => a.id === form.sourceAccountId);

  return (
    <>
      <form onSubmit={handleSubmitRequest} className="space-y-6">
        {/* Source account */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pine-900">
            Your account
          </h2>
          <Field
            label="From account"
            htmlFor="wire-from"
            hint={
              selectedAccount
                ? `Available: ${formatMoney(
                    selectedAccount.balances.available_balance,
                  )} · Ledger: ${formatMoney(selectedAccount.balances.ledger_balance)}`
                : undefined
            }
          >
            <AccountSelect
              id="wire-from"
              accounts={accounts}
              value={form.sourceAccountId}
              onChange={(v) => updateForm('sourceAccountId', v)}
            />
          </Field>
          <Field
            label="Amount (USD)"
            htmlFor="wire-amount"
            hint="Wires ≥ $25,000 are subject to compliance review before same-day dispatch."
          >
            <AmountInput
              id="wire-amount"
              value={form.amount}
              onChange={(v) => updateForm('amount', v)}
            />
          </Field>
          <Field label="Reference / memo (optional)" htmlFor="wire-ref">
            <input
              id="wire-ref"
              className="input"
              maxLength={140}
              placeholder="Invoice #, purpose, etc."
              value={form.reference}
              onChange={(e) => updateForm('reference', e.target.value)}
            />
          </Field>
        </div>

        <hr className="border-pine-100" />

        {/* Beneficiary */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pine-900">
            Beneficiary
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Beneficiary full name / company" htmlFor="wire-bname">
              <input
                id="wire-bname"
                className="input"
                required
                maxLength={140}
                value={beneficiary.name}
                onChange={(e) => updateBeneficiary('name', e.target.value)}
              />
            </Field>
            <Field label="Beneficiary address (optional)" htmlFor="wire-baddr">
              <input
                id="wire-baddr"
                className="input"
                maxLength={200}
                value={beneficiary.address}
                onChange={(e) => updateBeneficiary('address', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <hr className="border-pine-100" />

        {/* Receiving bank */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pine-900">
            Receiving bank
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Bank name" htmlFor="wire-bankname">
              <input
                id="wire-bankname"
                className="input"
                required
                maxLength={100}
                value={beneficiary.bankName}
                onChange={(e) => updateBeneficiary('bankName', e.target.value)}
              />
            </Field>
            <Field label="ABA routing number" htmlFor="wire-routing">
              <input
                id="wire-routing"
                className="input"
                required
                inputMode="numeric"
                pattern="[0-9]{9}"
                maxLength={9}
                placeholder="9 digits"
                value={beneficiary.routingNumber}
                onChange={(e) =>
                  updateBeneficiary('routingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))
                }
              />
            </Field>
            <Field
              label="Beneficiary account number"
              htmlFor="wire-acct"
              hint="Account number is encrypted at rest and never displayed again."
              className="md:col-span-2"
            >
              <input
                id="wire-acct"
                className="input"
                required
                inputMode="numeric"
                maxLength={20}
                value={beneficiary.accountNumber}
                onChange={(e) =>
                  updateBeneficiary('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 20))
                }
              />
            </Field>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}
        {result && (
          <Alert tone="success" title="Wire submitted." className="space-y-1">
            <p>
              Status:{' '}
              <span className="badge bg-pine-100 text-pine-800">
                {result.status === 'pending_review' ? 'pending review' : result.status}
              </span>
            </p>
            <p>
              Reference: <span className="font-mono text-xs">{result.transactionId}</span>
            </p>
            {result.status === 'pending_review' && (
              <p className="mt-1 text-xs text-amber-700">
                This wire exceeds the review threshold and will be processed after compliance
                review.
              </p>
            )}
          </Alert>
        )}

        <SubmitButton busy={busy} className="w-full">
          Review and send wire
        </SubmitButton>
      </form>

      <PinModal
        open={pinOpen}
        purpose="wire transfer"
        onConfirm={handlePinConfirm}
        onCancel={() => setPinOpen(false)}
      />
    </>
  );
}
