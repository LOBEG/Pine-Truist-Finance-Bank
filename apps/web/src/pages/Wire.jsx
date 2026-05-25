import { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { accountTitle, formatMoney } from '../api/format.js';
import { PinModal } from '../components/PinModal.jsx';

const EMPTY_BENEFICIARY = {
  name: '',
  bankName: '',
  routingNumber: '',
  accountNumber: '',
  address: '',
};

export function Wire() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    sourceAccountId: '',
    amount: '',
    reference: '',
  });
  const [beneficiary, setBeneficiary] = useState(EMPTY_BENEFICIARY);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api('/accounts').then((a) => setAccounts(a.accounts));
  }, []);

  function updateForm(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateBeneficiary(k, v) {
    setBeneficiary((b) => ({ ...b, [k]: v }));
  }

  function handleSubmitRequest(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setPinOpen(true);
  }

  async function handlePinConfirm(pin) {
    setPinOpen(false);
    setBusy(true);
    try {
      const r = await api('/transfers/wire/domestic', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
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
        },
      });
      setResult(r);
      setForm((f) => ({ ...f, amount: '', reference: '' }));
      setBeneficiary(EMPTY_BENEFICIARY);
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === form.sourceAccountId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pine-900">Domestic wire transfer</h1>
        <p className="text-pine-700 text-sm mt-1">
          Send a Fedwire to any US bank account. Same-day settlement for wires submitted before the
          4 PM ET cutoff.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmitRequest} className="space-y-6">
          {/* Source account */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-pine-900 uppercase tracking-wide">
              Your account
            </h2>
            <div>
              <label className="label">From account</label>
              <select
                required
                className="input"
                value={form.sourceAccountId}
                onChange={(e) => updateForm('sourceAccountId', e.target.value)}
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountTitle(a.type)} — {a.nickname} ••••{a.mask} —{' '}
                    {formatMoney(a.balances.available_balance)}
                  </option>
                ))}
              </select>
              {selectedAccount && (
                <p className="text-xs text-pine-700 mt-1">
                  Available: {formatMoney(selectedAccount.balances.available_balance)} · Ledger:{' '}
                  {formatMoney(selectedAccount.balances.ledger_balance)}
                </p>
              )}
            </div>
            <div>
              <label className="label">Amount (USD)</label>
              <input
                className="input"
                required
                inputMode="decimal"
                pattern="\d+(\.\d{1,2})?"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => updateForm('amount', e.target.value)}
              />
              <p className="text-xs text-pine-700 mt-1">
                Wires ≥ $25,000 are subject to compliance review before same-day dispatch.
              </p>
            </div>
            <div>
              <label className="label">Reference / memo (optional)</label>
              <input
                className="input"
                maxLength={140}
                placeholder="Invoice #, purpose, etc."
                value={form.reference}
                onChange={(e) => updateForm('reference', e.target.value)}
              />
            </div>
          </div>

          <hr className="border-pine-100" />

          {/* Beneficiary */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-pine-900 uppercase tracking-wide">
              Beneficiary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Beneficiary full name / company</label>
                <input
                  className="input"
                  required
                  maxLength={140}
                  value={beneficiary.name}
                  onChange={(e) => updateBeneficiary('name', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Beneficiary address (optional)</label>
                <input
                  className="input"
                  maxLength={200}
                  value={beneficiary.address}
                  onChange={(e) => updateBeneficiary('address', e.target.value)}
                />
              </div>
            </div>
          </div>

          <hr className="border-pine-100" />

          {/* Receiving bank */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-pine-900 uppercase tracking-wide">
              Receiving bank
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Bank name</label>
                <input
                  className="input"
                  required
                  maxLength={100}
                  value={beneficiary.bankName}
                  onChange={(e) => updateBeneficiary('bankName', e.target.value)}
                />
              </div>
              <div>
                <label className="label">ABA routing number</label>
                <input
                  className="input"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  placeholder="9 digits"
                  value={beneficiary.routingNumber}
                  onChange={(e) =>
                    updateBeneficiary(
                      'routingNumber',
                      e.target.value.replace(/\D/g, '').slice(0, 9),
                    )
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Beneficiary account number</label>
                <input
                  className="input"
                  required
                  inputMode="numeric"
                  maxLength={20}
                  value={beneficiary.accountNumber}
                  onChange={(e) =>
                    updateBeneficiary(
                      'accountNumber',
                      e.target.value.replace(/\D/g, '').slice(0, 20),
                    )
                  }
                />
                <p className="text-xs text-pine-700 mt-1">
                  Account number is encrypted at rest and never displayed again.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {result && (
            <div className="text-sm text-pine-800 bg-pine-50 ring-1 ring-pine-200 rounded-lg p-4 space-y-1">
              <p className="font-semibold">Wire submitted.</p>
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
                <p className="text-amber-700 text-xs mt-1">
                  This wire exceeds the review threshold and will be processed after compliance
                  review.
                </p>
              )}
            </div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Review and send wire'}
          </button>
        </form>
      </div>

      <PinModal
        open={pinOpen}
        purpose="wire transfer"
        onConfirm={handlePinConfirm}
        onCancel={() => setPinOpen(false)}
      />
    </div>
  );
}
