import { useCallback, useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { formatDate, formatMoney } from '../api/format.js';
import {
  AccountSelect,
  Alert,
  AmountInput,
  AsyncBoundary,
  Field,
  SubmitButton,
} from '../components/ui.jsx';
import { useMutation } from '../hooks/useMutation.js';

/**
 * WithdrawPanel — request a withdrawal and review prior requests.
 * Embeddable in the Move Money flow. Accounts are provided by the parent.
 */
export function WithdrawPanel({ accounts }) {
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [form, setForm] = useState({ accountId: '', amount: '', method: 'wire', notes: '' });

  const reloadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const w = await api('/withdrawals');
      setItems(w.items);
    } catch (err) {
      setListError(err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  const { run, busy, error } = useMutation((body) =>
    api('/withdrawals', { method: 'POST', idempotencyKey: newIdempotencyKey(), body }),
  );

  async function submit(e) {
    e.preventDefault();
    try {
      await run({ ...form, amount: form.amount });
      setForm((f) => ({ ...f, amount: '', notes: '' }));
      await reloadList();
    } catch {
      /* error surfaced via useMutation */
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="card">
        <form onSubmit={submit} className="space-y-4">
          <Field label="From account" htmlFor="wd-from">
            <AccountSelect
              id="wd-from"
              accounts={accounts}
              value={form.accountId}
              onChange={(v) => setForm({ ...form, accountId: v })}
            />
          </Field>
          <Field label="Amount (USD)" htmlFor="wd-amount">
            <AmountInput
              id="wd-amount"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
            />
          </Field>
          <Field label="Method" htmlFor="wd-method">
            <select
              id="wd-method"
              className="input"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            >
              <option value="wire">Domestic wire</option>
              <option value="ach_external">ACH to external account</option>
              <option value="check">Cashier&apos;s check</option>
              <option value="cash">Branch cash pickup</option>
            </select>
          </Field>
          <Field label="Notes" htmlFor="wd-notes">
            <textarea
              id="wd-notes"
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <SubmitButton busy={busy} className="w-full">
            Submit request
          </SubmitButton>
          <p className="text-xs text-pine-700">
            Withdrawals require admin approval. Funds are held in pending until approved.
          </p>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-pine-900">Your requests</h2>
        <AsyncBoundary
          loading={listLoading}
          error={listError}
          onRetry={reloadList}
          isEmpty={items.length === 0}
          empty="No withdrawal requests yet."
        >
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pine-50">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-left">Method</th>
                  <th className="p-3 text-left">Status</th>
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
                        <div className="mt-1 text-xs text-red-700">{w.rejection_reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncBoundary>
      </div>
    </div>
  );
}
