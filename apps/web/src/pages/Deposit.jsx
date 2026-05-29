import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { accountTitle, formatDate, formatMoney } from '../api/format.js';
import { AsyncBoundary } from '../components/ui.jsx';

/**
 * DepositPanel — shows funding instructions for a chosen account plus recent
 * incoming deposits. Embeddable in the Move Money flow; accounts are provided
 * by the parent.
 */
export function DepositPanel({ accounts }) {
  const [selected, setSelected] = useState(accounts[0] || null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep a valid selection as accounts load/refresh.
  useEffect(() => {
    if (!selected && accounts.length > 0) setSelected(accounts[0]);
    else if (selected && !accounts.some((a) => a.id === selected.id) && accounts.length > 0) {
      setSelected(accounts[0]);
    }
  }, [accounts, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    api(`/transactions?accountId=${selected.id}&limit=20&type=deposit`)
      .then((r) => setRecent(r.items))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [selected]);

  if (!selected) {
    return <div className="card text-center text-sm text-pine-700">No accounts available.</div>;
  }

  return (
    <div className="space-y-6">
      {accounts.length > 1 && (
        <div className="card">
          <label className="label" htmlFor="dep-account">
            Select account
          </label>
          <select
            id="dep-account"
            className="input"
            value={selected.id}
            onChange={(e) => setSelected(accounts.find((a) => a.id === e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountTitle(a.type)} — {a.nickname} ••••{a.mask}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Account details card */}
        <div className="card space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-pine-600">
              {accountTitle(selected.type)}
            </p>
            <p className="text-xl font-bold text-pine-900">{selected.nickname}</p>
            <p className="text-sm text-pine-700">
              Available: {formatMoney(selected.balances.available_balance)}
            </p>
          </div>

          <hr className="border-pine-100" />

          <div className="space-y-3">
            <div>
              <p className="mb-0.5 text-xs uppercase tracking-wide text-pine-600">
                Routing number (ABA)
              </p>
              <p className="font-mono text-lg font-semibold text-pine-900">
                {selected.routingNumber}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-xs uppercase tracking-wide text-pine-600">Account number</p>
              <p className="font-mono text-lg font-semibold text-pine-900">••••••{selected.mask}</p>
              <p className="mt-1 text-xs text-pine-600">
                Full account number available at branch or via secure request.
              </p>
            </div>
          </div>

          <hr className="border-pine-100" />

          <div>
            <p className="mb-2 text-sm font-semibold text-pine-900">Accepted deposit methods</p>
            <ul className="space-y-2 text-sm text-pine-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-pine-500">✓</span>
                <span>
                  <strong>Incoming domestic wire</strong> — same-day credit for wires received
                  before 4 PM ET on business days.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-pine-500">✓</span>
                <span>
                  <strong>ACH credit (direct deposit)</strong> — standard 1–2 business day
                  settlement. Provide routing and account number to your sender.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-pine-500">✓</span>
                <span>
                  <strong>Cashier&apos;s check / money order</strong> — mail or present at any Pine
                  Truist Finance Bank branch. Funds available within 1 business day.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-pine-500">✓</span>
                <span>
                  <strong>Internal transfer</strong> — instant between your Pine Truist Finance Bank
                  accounts via the Transfer tab.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Recent deposits */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-pine-900">Recent deposits</h2>
          <AsyncBoundary
            loading={loading}
            error={error}
            isEmpty={recent.length === 0}
            empty="No recent deposits."
          >
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-pine-50">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-t border-pine-100">
                      <td className="whitespace-nowrap p-3 text-pine-700">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="p-3">{t.description || t.memo || '—'}</td>
                      <td className="p-3 text-right font-semibold text-pine-800">
                        +{formatMoney(t.amount)}
                      </td>
                      <td className="p-3">
                        <span className="badge bg-pine-100 text-pine-800">{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncBoundary>
        </div>
      </div>
    </div>
  );
}
