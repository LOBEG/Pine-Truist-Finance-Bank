import { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { accountTitle, formatMoney } from '../api/format.js';

export function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    amount: '',
    memo: '',
    pin: '',
  });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/accounts').then((a) => setAccounts(a.accounts));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await api('/transfers/internal', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { ...form, amount: form.amount },
      });
      setResult(r);
      setForm((f) => ({ ...f, amount: '', memo: '', pin: '' }));
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-pine-900 mb-4">Internal transfer</h1>
      <div className="card">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">From account</label>
            <select
              required
              className="input"
              value={form.sourceAccountId}
              onChange={(e) => setForm({ ...form, sourceAccountId: e.target.value })}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountTitle(a.type)} {a.nickname} ••••{a.mask} —{' '}
                  {formatMoney(a.balances.available_balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To account</label>
            <select
              required
              className="input"
              value={form.destinationAccountId}
              onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })}
            >
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.id !== form.sourceAccountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountTitle(a.type)} {a.nickname} ••••{a.mask}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (USD)</label>
            <input
              className="input"
              required
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Memo</label>
            <input
              className="input"
              maxLength={140}
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Transfer PIN</label>
            <input
              className="input"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6 digits — issued by your banker"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
            />
            <p className="text-xs text-pine-700 mt-1">
              Single-use PIN. Contact support if you don&apos;t have an active PIN.
            </p>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {result && (
            <div className="text-sm text-pine-800 bg-pine-50 ring-1 ring-pine-200 rounded-lg p-3">
              Transfer {result.status}. Reference:{' '}
              <span className="font-mono">{result.transactionId}</span>
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Submitting…' : 'Send transfer'}
          </button>
        </form>
      </div>
    </div>
  );
}
