import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { formatMoney, formatDate, accountTitle } from '../api/format.js';
import { useRealtime } from '../realtime/socket.js';

export function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([api('/accounts'), api('/transactions?limit=10')]);
      setAccounts(a.accounts);
      setRecent(t.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useRealtime({
    'transaction.posted': () => reload(),
    'balance.updated': () => reload(),
    'withdrawal.approved': () => reload(),
  });

  const total = accounts.reduce((s, a) => s + Number(a.balances.available_balance || 0), 0);

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-pine-900">Good day.</h1>
            <p className="text-pine-700">
              Here is a summary of your Pine Truist Finance Bank accounts.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-pine-700">Total assets</p>
            <p className="text-3xl font-bold text-pine-800">{formatMoney(total)}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-pine-900 mb-3">Your accounts</h2>
        {loading ? (
          <div className="card">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((a) => (
              <div key={a.id} className="card flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-pine-600">
                      {accountTitle(a.type)}
                    </p>
                    <p className="font-semibold text-pine-900">{a.nickname}</p>
                  </div>
                  <span
                    className={`badge ${a.status === 'active' ? 'bg-pine-100 text-pine-800' : 'bg-amber-100 text-amber-800'}`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-3xl font-bold text-pine-900">
                  {formatMoney(a.balances.available_balance)}
                </p>
                <p className="text-xs text-pine-600">
                  Available · ledger {formatMoney(a.balances.ledger_balance)}
                </p>
                <p className="text-xs text-pine-600">
                  Routing {a.routingNumber} · ••••{a.mask}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-pine-900 mb-3">Recent activity</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pine-50">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Type</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-t border-pine-100">
                  <td className="p-3 text-pine-700">{formatDate(t.created_at)}</td>
                  <td className="p-3">{t.description || t.memo || '—'}</td>
                  <td className="p-3 text-pine-700">{t.type}</td>
                  <td className="p-3 text-right font-semibold">{formatMoney(t.amount)}</td>
                  <td className="p-3">
                    <span className="badge bg-pine-100 text-pine-800">{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
