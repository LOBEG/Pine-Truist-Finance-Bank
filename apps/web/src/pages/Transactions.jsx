import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatMoney, formatDate } from '../api/format.js';

export function Transactions() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState({ accountId: '', type: '', status: '' });
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/accounts').then((a) => setAccounts(a.accounts));
  }, []);

  async function load(reset = false) {
    setLoading(true);
    const q = new URLSearchParams({ limit: '50' });
    if (filter.accountId) q.set('accountId', filter.accountId);
    if (filter.type) q.set('type', filter.type);
    if (filter.status) q.set('status', filter.status);
    if (!reset && cursor) q.set('cursor', cursor);
    try {
      const r = await api(`/transactions?${q.toString()}`);
      setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCursor(null);
    load(true); /* eslint-disable-next-line */
  }, [filter.accountId, filter.type, filter.status]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-pine-900">Transactions</h1>
      <div className="card grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Account</label>
          <select
            className="input"
            value={filter.accountId}
            onChange={(e) => setFilter((f) => ({ ...f, accountId: e.target.value }))}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nickname} ••••{a.mask}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">Any</option>
            <option>deposit</option>
            <option>withdrawal</option>
            <option>internal_transfer</option>
            <option>ach_credit</option>
            <option>ach_debit</option>
            <option>wire_domestic</option>
            <option>fee</option>
            <option>interest</option>
            <option>reversal</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Any</option>
            <option>posted</option>
            <option>pending</option>
            <option>settled</option>
            <option>pending_review</option>
            <option>reversed</option>
            <option>failed</option>
          </select>
        </div>
      </div>

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
            {items.map((t) => (
              <tr key={t.id} className="border-t border-pine-100">
                <td className="p-3 text-pine-700 whitespace-nowrap">{formatDate(t.created_at)}</td>
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
        <div className="p-3 flex justify-center">
          {cursor ? (
            <button className="btn-secondary" disabled={loading} onClick={() => load(false)}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          ) : (
            <span className="text-xs text-pine-700">{items.length} transactions</span>
          )}
        </div>
      </div>
    </div>
  );
}
