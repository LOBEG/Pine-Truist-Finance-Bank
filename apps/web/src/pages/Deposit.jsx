import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatMoney, formatDate, accountTitle } from '../api/format.js';

export function Deposit() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const a = await api('/accounts');
        setAccounts(a.accounts);
        if (a.accounts.length > 0) setSelected(a.accounts[0]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    api(`/transactions?accountId=${selected.id}&limit=20&type=deposit`)
      .then((r) => setRecent(r.items))
      .catch(() => setRecent([]));
  }, [selected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pine-900">Deposit funds</h1>
        <p className="text-pine-700 text-sm mt-1">
          Send funds to any of your Pine Truist Finance Bank accounts using the routing and account
          number below.
        </p>
      </div>

      {loading ? (
        <div className="card">Loading accounts…</div>
      ) : (
        <>
          {/* Account selector */}
          {accounts.length > 1 && (
            <div className="card">
              <label className="label">Select account</label>
              <select
                className="input"
                value={selected?.id || ''}
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

          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <p className="text-xs text-pine-600 uppercase tracking-wide mb-0.5">
                      Routing number (ABA)
                    </p>
                    <p className="font-mono text-lg font-semibold text-pine-900">
                      {selected.routingNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-pine-600 uppercase tracking-wide mb-0.5">
                      Account number
                    </p>
                    <p className="font-mono text-lg font-semibold text-pine-900">
                      ••••••{selected.mask}
                    </p>
                    <p className="text-xs text-pine-600 mt-1">
                      Full account number available at branch or via secure request.
                    </p>
                  </div>
                </div>

                <hr className="border-pine-100" />

                <div>
                  <p className="text-sm font-semibold text-pine-900 mb-2">
                    Accepted deposit methods
                  </p>
                  <ul className="space-y-2 text-sm text-pine-700">
                    <li className="flex items-start gap-2">
                      <span className="text-pine-500 mt-0.5">✓</span>
                      <span>
                        <strong>Incoming domestic wire</strong> — same-day credit for wires received
                        before 4 PM ET on business days.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pine-500 mt-0.5">✓</span>
                      <span>
                        <strong>ACH credit (direct deposit)</strong> — standard 1–2 business day
                        settlement. Provide routing and account number to your sender.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pine-500 mt-0.5">✓</span>
                      <span>
                        <strong>Cashier&apos;s check / money order</strong> — mail or present at any
                        Pine Truist Finance Bank branch. Funds available within 1 business day.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pine-500 mt-0.5">✓</span>
                      <span>
                        <strong>Internal transfer</strong> — instant between your Pine Truist
                        Finance Bank accounts. Use the{' '}
                        <a className="text-pine-700 underline" href="/transfer">
                          Transfer
                        </a>{' '}
                        page.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Recent deposits */}
              <div>
                <h2 className="text-lg font-semibold text-pine-900 mb-3">Recent deposits</h2>
                <div className="card p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-pine-50">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Description</th>
                        <th className="text-right p-3">Amount</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((t) => (
                        <tr key={t.id} className="border-t border-pine-100">
                          <td className="p-3 text-pine-700 whitespace-nowrap">
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
                      {recent.length === 0 && (
                        <tr>
                          <td className="p-6 text-center text-pine-700" colSpan={4}>
                            No recent deposits.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
