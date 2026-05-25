import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { api, newIdempotencyKey } from '../api/client.js';
import { formatDate, formatMoney } from '../api/format.js';

const ADMIN = '/admin';

function AdminLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-pine-700 text-white' : 'text-pine-800 hover:bg-pine-100'}`
      }
    >
      {children}
    </NavLink>
  );
}

function Users() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState(null);
  const [purpose, setPurpose] = useState('internal_transfer');
  const [expiresIn, setExpiresIn] = useState(30);

  async function load() {
    const r = await api(`${ADMIN}/users?limit=50`);
    setItems(r.items);
  }
  useEffect(() => {
    load();
  }, []);

  async function issuePin() {
    setPin(null);
    const r = await api(`${ADMIN}/users/${selected.id}/pins`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
      body: { purpose, expiresInMinutes: Number(expiresIn) },
    });
    setPin(r);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-pine-50">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">KYC</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr
                key={u.id}
                onClick={() => {
                  setSelected(u);
                  setPin(null);
                }}
                className={`border-t border-pine-100 cursor-pointer ${selected?.id === u.id ? 'bg-pine-50' : ''}`}
              >
                <td className="p-3">
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-pine-700">{u.email}</div>
                </td>
                <td className="p-3">
                  <span className="badge bg-pine-100 text-pine-800">{u.kyc_status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:col-span-2 space-y-4">
        {!selected ? (
          <div className="card text-pine-700">Select a user.</div>
        ) : (
          <>
            <div className="card">
              <h3 className="font-semibold text-pine-900">{selected.full_name}</h3>
              <p className="text-sm text-pine-700">{selected.email}</p>
              <p className="text-xs text-pine-700 mt-2">
                Roles: {(selected.roles || []).join(', ')}
              </p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-pine-900 mb-3">Issue transfer PIN</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Purpose</label>
                  <select
                    className="input"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    <option value="internal_transfer">Internal transfer</option>
                    <option value="ach_transfer">ACH transfer</option>
                    <option value="wire_transfer">Wire transfer</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div>
                  <label className="label">Expires in (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    className="input"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button className="btn-primary w-full" onClick={issuePin}>
                    Generate PIN
                  </button>
                </div>
              </div>
              {pin && (
                <div className="mt-4 p-4 bg-amber-50 ring-1 ring-amber-200 rounded-lg">
                  <p className="text-xs uppercase tracking-wide text-amber-800">One-time PIN</p>
                  <p className="text-3xl font-mono font-bold text-amber-900">{pin.pin}</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Deliver to customer out-of-band. Expires {formatDate(pin.expiresAt)}.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Withdrawals() {
  const [items, setItems] = useState([]);
  async function load() {
    const r = await api(`${ADMIN}/withdrawals?status=pending`);
    setItems(r.items);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id, action, reason) {
    const body = action === 'reject' ? { reason: reason || 'Declined' } : undefined;
    await api(`${ADMIN}/withdrawals/${id}/${action}`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
      body,
    });
    await load();
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-pine-50">
          <tr>
            <th className="text-left p-3">Requested</th>
            <th className="text-left p-3">Customer</th>
            <th className="text-left p-3">Account</th>
            <th className="text-right p-3">Amount</th>
            <th className="text-left p-3">Method</th>
            <th className="text-right p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id} className="border-t border-pine-100">
              <td className="p-3 text-pine-700">{formatDate(w.requested_at)}</td>
              <td className="p-3">
                {w.full_name}
                <div className="text-xs text-pine-700">{w.email}</div>
              </td>
              <td className="p-3">
                {w.account_type} ••••{w.account_number_last4}
              </td>
              <td className="p-3 text-right font-semibold">{formatMoney(w.amount)}</td>
              <td className="p-3">{w.method}</td>
              <td className="p-3 text-right space-x-2">
                <button className="btn-primary" onClick={() => act(w.id, 'approve')}>
                  Approve
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const reason = prompt('Reason for rejection?');
                    if (reason !== null) act(w.id, 'reject', reason);
                  }}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="p-6 text-center text-pine-700" colSpan={6}>
                No pending requests.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Audit() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api(`${ADMIN}/audit?limit=100`).then((r) => setItems(r.items));
  }, []);
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-pine-50">
          <tr>
            <th className="text-left p-3">Time</th>
            <th className="text-left p-3">Actor</th>
            <th className="text-left p-3">Action</th>
            <th className="text-left p-3">Resource</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-pine-100">
              <td className="p-3 text-pine-700">{formatDate(a.created_at)}</td>
              <td className="p-3 text-xs font-mono">{a.actor_user_id || 'system'}</td>
              <td className="p-3">
                <span className="badge bg-pine-100 text-pine-800">{a.action}</span>
              </td>
              <td className="p-3 text-xs">
                {a.resource_type} {a.resource_id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Admin() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-pine-900">Admin console</h1>
      <nav className="flex gap-2 border-b border-pine-200 pb-2">
        <AdminLink to="/admin">Users</AdminLink>
        <AdminLink to="/admin/withdrawals">Withdrawals</AdminLink>
        <AdminLink to="/admin/audit">Audit</AdminLink>
      </nav>
      <Routes>
        <Route index element={<Users />} />
        <Route path="withdrawals" element={<Withdrawals />} />
        <Route path="audit" element={<Audit />} />
      </Routes>
    </div>
  );
}
