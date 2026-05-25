import { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { accountTitle, formatMoney } from '../api/format.js';
import { PinModal } from '../components/PinModal.jsx';

// ─────────────────────────────────────────
// Internal transfer tab
// ─────────────────────────────────────────
function InternalTab({ accounts }) {
  const [form, setForm] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    amount: '',
    memo: '',
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
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
      const r = await api('/transfers/internal', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { ...form, pin },
      });
      setResult(r);
      setForm((f) => ({ ...f, amount: '', memo: '' }));
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmitRequest} className="space-y-4">
        <div>
          <label className="label">From account</label>
          <select
            required
            className="input"
            value={form.sourceAccountId}
            onChange={(e) => update('sourceAccountId', e.target.value)}
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
            onChange={(e) => update('destinationAccountId', e.target.value)}
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
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Memo (optional)</label>
          <input
            className="input"
            maxLength={140}
            value={form.memo}
            onChange={(e) => update('memo', e.target.value)}
          />
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
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Transfer funds'}
        </button>
      </form>
      <PinModal
        open={pinOpen}
        purpose="internal transfer"
        onConfirm={handlePinConfirm}
        onCancel={() => setPinOpen(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────
// ACH transfer tab
// ─────────────────────────────────────────
const EMPTY_CP = {
  name: '',
  bankName: '',
  routingNumber: '',
  accountNumber: '',
  accountType: 'checking',
  country: 'US',
};

function AchTab({ accounts }) {
  const [counterparties, setCounterparties] = useState([]);
  const [showAddCp, setShowAddCp] = useState(false);
  const [cpForm, setCpForm] = useState(EMPTY_CP);
  const [cpBusy, setCpBusy] = useState(false);
  const [cpError, setCpError] = useState(null);

  const [form, setForm] = useState({
    sourceAccountId: '',
    counterpartyId: '',
    amount: '',
    direction: 'credit',
    secCode: 'PPD',
    effectiveDate: '',
    memo: '',
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function loadCounterparties() {
    const r = await api('/counterparties');
    setCounterparties(r.items);
  }

  useEffect(() => {
    loadCounterparties();
  }, []);

  function updateCp(k, v) {
    setCpForm((f) => ({ ...f, [k]: v }));
  }
  function updateForm(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function addCounterparty(e) {
    e.preventDefault();
    setCpError(null);
    setCpBusy(true);
    try {
      await api('/counterparties', { method: 'POST', body: cpForm });
      setCpForm(EMPTY_CP);
      setShowAddCp(false);
      await loadCounterparties();
    } catch (err) {
      setCpError(err.detail || err.message);
    } finally {
      setCpBusy(false);
    }
  }

  async function deleteCounterparty(id) {
    await api(`/counterparties/${id}`, { method: 'DELETE' });
    await loadCounterparties();
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
      const body = { ...form, pin };
      const r = await api('/transfers/ach', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body,
      });
      setResult(r);
      setForm((f) => ({ ...f, amount: '', memo: '' }));
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Counterparty manager */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-pine-900">
            External accounts (counterparties)
          </h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setShowAddCp((v) => !v)}
          >
            {showAddCp ? 'Cancel' : '+ Add account'}
          </button>
        </div>

        {showAddCp && (
          <form onSubmit={addCounterparty} className="card mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Account holder name</label>
                <input
                  className="input"
                  required
                  value={cpForm.name}
                  onChange={(e) => updateCp('name', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Bank name</label>
                <input
                  className="input"
                  required
                  value={cpForm.bankName}
                  onChange={(e) => updateCp('bankName', e.target.value)}
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
                  value={cpForm.routingNumber}
                  onChange={(e) =>
                    updateCp('routingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))
                  }
                />
              </div>
              <div>
                <label className="label">Account number</label>
                <input
                  className="input"
                  required
                  inputMode="numeric"
                  maxLength={20}
                  value={cpForm.accountNumber}
                  onChange={(e) =>
                    updateCp('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 20))
                  }
                />
              </div>
              <div>
                <label className="label">Account type</label>
                <select
                  className="input"
                  value={cpForm.accountType}
                  onChange={(e) => updateCp('accountType', e.target.value)}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
            </div>
            {cpError && (
              <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
                {cpError}
              </div>
            )}
            <button className="btn-primary" type="submit" disabled={cpBusy}>
              {cpBusy ? 'Saving…' : 'Save account'}
            </button>
          </form>
        )}

        {counterparties.length > 0 ? (
          <div className="card p-0 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-pine-50">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Bank</th>
                  <th className="text-left p-3">Account</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {counterparties.map((cp) => (
                  <tr key={cp.id} className="border-t border-pine-100">
                    <td className="p-3 font-medium">{cp.name}</td>
                    <td className="p-3 text-pine-700">{cp.bank_name}</td>
                    <td className="p-3 text-pine-700">
                      {cp.routing_number} · ••••{cp.account_number_last4}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => deleteCounterparty(cp.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !showAddCp && (
            <p className="text-sm text-pine-700 mb-4">
              No external accounts on file. Add one above to initiate ACH transfers.
            </p>
          )
        )}
      </div>

      {/* ACH transfer form */}
      <form onSubmit={handleSubmitRequest} className="space-y-4">
        <div>
          <label className="label">From account (Pine Bank)</label>
          <select
            required
            className="input"
            value={form.sourceAccountId}
            onChange={(e) => updateForm('sourceAccountId', e.target.value)}
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
          <label className="label">External account (counterparty)</label>
          <select
            required
            className="input"
            value={form.counterpartyId}
            onChange={(e) => updateForm('counterpartyId', e.target.value)}
          >
            <option value="">Select…</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name} — ••••{cp.account_number_last4}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Direction</label>
            <select
              className="input"
              value={form.direction}
              onChange={(e) => updateForm('direction', e.target.value)}
            >
              <option value="credit">Credit (send money out)</option>
              <option value="debit">Debit (pull money in)</option>
            </select>
          </div>
          <div>
            <label className="label">SEC code</label>
            <select
              className="input"
              value={form.secCode}
              onChange={(e) => updateForm('secCode', e.target.value)}
            >
              <option value="PPD">PPD — Personal</option>
              <option value="CCD">CCD — Business</option>
              <option value="WEB">WEB — Internet-initiated</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          <div>
            <label className="label">Effective date</label>
            <input
              className="input"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={form.effectiveDate}
              onChange={(e) => updateForm('effectiveDate', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Memo (optional)</label>
          <input
            className="input"
            maxLength={140}
            value={form.memo}
            onChange={(e) => updateForm('memo', e.target.value)}
          />
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
        {result && (
          <div className="text-sm text-pine-800 bg-pine-50 ring-1 ring-pine-200 rounded-lg p-3">
            ACH initiated. <span className="badge bg-pine-100 text-pine-800">{result.status}</span>{' '}
            Reference: <span className="font-mono">{result.transactionId}</span>
          </div>
        )}
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={busy || counterparties.length === 0}
        >
          {busy ? 'Submitting…' : 'Submit ACH'}
        </button>
        {counterparties.length === 0 && (
          <p className="text-xs text-pine-700 text-center">
            Add an external account above before initiating an ACH transfer.
          </p>
        )}
      </form>

      <PinModal
        open={pinOpen}
        purpose="ACH transfer"
        onConfirm={handlePinConfirm}
        onCancel={() => setPinOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────
// Main Transfer page (tabbed)
// ─────────────────────────────────────────
const TABS = [
  { key: 'internal', label: 'Internal' },
  { key: 'ach', label: 'ACH' },
];

export function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState('internal');

  useEffect(() => {
    api('/accounts').then((a) => setAccounts(a.accounts));
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-pine-900">Transfer</h1>

      <div className="flex gap-2 border-b border-pine-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-pine-700 text-white' : 'text-pine-800 hover:bg-pine-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'internal' && <InternalTab accounts={accounts} />}
        {tab === 'ach' && <AchTab accounts={accounts} />}
      </div>

      {tab === 'internal' && (
        <p className="text-xs text-pine-700 text-center">
          For external bank wires, use the{' '}
          <a href="/wire" className="text-pine-800 underline">
            Wire transfer
          </a>{' '}
          page.
        </p>
      )}
    </div>
  );
}
