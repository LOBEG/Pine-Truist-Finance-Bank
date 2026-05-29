import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { formatMoney, formatDate, accountTitle } from '../api/format.js';
import { useRealtime } from '../realtime/socket.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { AsyncBoundary, PageHeader } from '../components/ui.jsx';

const QUICK_ACTIONS = [
  { to: '/transfer', label: 'Transfer', icon: '↔️' },
  { to: '/wire', label: 'Wire', icon: '🏦' },
  { to: '/deposit', label: 'Deposit', icon: '📥' },
  { to: '/withdraw', label: 'Withdraw', icon: '📤' },
];

export function Dashboard() {
  const { accounts, loading, error, reload, totalAvailable } = useAccounts();
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState(null);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError(null);
    try {
      const t = await api('/transactions?limit=10');
      setRecent(t.items);
    } catch (err) {
      setRecentError(err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useRealtime({
    'transaction.posted': () => loadRecent(),
    'balance.updated': () => loadRecent(),
    'withdrawal.approved': () => loadRecent(),
  });

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-pine-900">Good day.</h1>
            <p className="text-pine-700">
              Here is a summary of your Pine Truist Finance Bank accounts.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-pine-700">Total assets</p>
            <p className="text-3xl font-bold text-pine-800">{formatMoney(totalAvailable)}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-1 rounded-xl border border-pine-100 bg-white px-3 py-4 text-sm font-semibold text-pine-800 shadow-sm transition hover:border-pine-300 hover:bg-pine-50"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                {a.icon}
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-pine-900">Your accounts</h2>
        <AsyncBoundary
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={accounts.length === 0}
          empty="You don't have any accounts yet."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <div className="mt-2 flex gap-2">
                  <Link to="/transfer" className="btn-secondary px-3 py-1.5 text-xs">
                    Transfer
                  </Link>
                  <Link to="/deposit" className="btn-secondary px-3 py-1.5 text-xs">
                    Deposit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-pine-900">Recent activity</h2>
        <AsyncBoundary
          loading={recentLoading}
          error={recentError}
          onRetry={loadRecent}
          isEmpty={recent.length === 0}
          empty="No recent activity."
        >
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pine-50">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-left">Status</th>
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
        </AsyncBoundary>
      </section>
    </div>
  );
}
