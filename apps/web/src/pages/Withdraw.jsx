import { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { accountTitle, formatDate, formatMoney } from '../api/format.js';

export function Withdraw() {
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ accountId: '', amount: '', method: 'wire', notes: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [a, w] = await Promise.all([api('/accounts'), api('/withdrawals')]);
    setAccounts(a.accounts);
    setItems(w.items);
  }
  useEffect(() => {
    reload();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/withdrawals', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { ...form, amount: form.amount },
      });
      setForm((f) => ({ ...f, amount: '', notes: '' }));
      await reload();
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h1 className="text-2xl font-bold text-pine-900 mb-4">Request a withdrawal</h1>
        <div className="card">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">From account</label>
              <select
                required
                className="input"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
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
              <label className="label">Method</label>
              <select
                className="input"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="wire">Domestic wire</option>
                <option value="ach_external">ACH to external account</option>
                <option value="check">Cashier&apos;s check</option>
                <option value="cash">Branch cash pickup</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
            <p className="text-xs text-pine-700">
              Withdrawals require admin approval. Funds are held in pending until approved.
            </p>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-pine-900 mb-3">Your requests</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pine-50">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-t border-pine-100">
                  <td className="p-3 text-pine-700">{formatDate(w.requested_at)}</td>
                  <td className="p-3 text-right font-semibold">{formatMoney(w.amount)}</td>
                  <td className="p-3 text-pine-700">{w.method}</td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        w.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : w.status === 'disbursed' || w.status === 'approved'
                            ? 'bg-pine-100 text-pine-800'
                            : w.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-pine-100 text-pine-800'
                      }`}
                    >
                      {w.status}
                    </span>
                    {w.rejection_reason && (
                      <div className="text-xs text-red-700 mt-1">{w.rejection_reason}</div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-pine-700" colSpan={4}>
                    No withdrawal requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
