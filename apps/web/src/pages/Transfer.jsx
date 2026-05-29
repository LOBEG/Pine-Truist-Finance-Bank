import { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from '../api/client.js';
import { PinModal } from '../components/PinModal.jsx';
import { AccountSelect, Alert, AmountInput, Field, SubmitButton } from '../components/ui.jsx';
import { useMutation } from '../hooks/useMutation.js';

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
  const { run, busy, error, result } = useMutation((body) =>
    api('/transfers/internal', { method: 'POST', idempotencyKey: newIdempotencyKey(), body }),
  );

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmitRequest(e) {
    e.preventDefault();
    setPinOpen(true);
  }

  async function handlePinConfirm(pin) {
    setPinOpen(false);
    try {
      await run({ ...form, pin });
      setForm((f) => ({ ...f, amount: '', memo: '' }));
    } catch {
      /* error surfaced via useMutation */
    }
  }

  return (
    <>
      <form onSubmit={handleSubmitRequest} className="space-y-4">
        <Field label="From account" htmlFor="int-from">
          <AccountSelect
            id="int-from"
            accounts={accounts}
            value={form.sourceAccountId}
            onChange={(v) => update('sourceAccountId', v)}
          />
        </Field>
        <Field label="To account" htmlFor="int-to">
          <AccountSelect
            id="int-to"
            accounts={accounts}
            value={form.destinationAccountId}
            onChange={(v) => update('destinationAccountId', v)}
            showBalance={false}
            exclude={form.sourceAccountId}
          />
        </Field>
        <Field label="Amount (USD)" htmlFor="int-amount">
          <AmountInput id="int-amount" value={form.amount} onChange={(v) => update('amount', v)} />
        </Field>
        <Field label="Memo (optional)" htmlFor="int-memo">
          <input
            id="int-memo"
            className="input"
            maxLength={140}
            value={form.memo}
            onChange={(e) => update('memo', e.target.value)}
          />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        {result && (
          <Alert tone="success">
            Transfer {result.status}. Reference:{' '}
            <span className="font-mono">{result.transactionId}</span>
          </Alert>
        )}
        <SubmitButton busy={busy} className="w-full">
          Transfer funds
        </SubmitButton>
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
  const addCp = useMutation((body) => api('/counterparties', { method: 'POST', body }));

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
  const transfer = useMutation((body) =>
    api('/transfers/ach', { method: 'POST', idempotencyKey: newIdempotencyKey(), body }),
  );

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
    try {
      await addCp.run(cpForm);
      setCpForm(EMPTY_CP);
      setShowAddCp(false);
      await loadCounterparties();
    } catch {
      /* error surfaced via useMutation */
    }
  }

  async function deleteCounterparty(id) {
    await api(`/counterparties/${id}`, { method: 'DELETE' });
    await loadCounterparties();
  }

  function handleSubmitRequest(e) {
    e.preventDefault();
    setPinOpen(true);
  }

  async function handlePinConfirm(pin) {
    setPinOpen(false);
    try {
      await transfer.run({ ...form, pin });
      setForm((f) => ({ ...f, amount: '', memo: '' }));
    } catch {
      /* error surfaced via useMutation */
    }
  }

  return (
    <div className="space-y-6">
      {/* Counterparty manager */}
      <div>
        <div className="mb-3 flex items-center justify-between">
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Account holder name" htmlFor="cp-name">
                <input
                  id="cp-name"
                  className="input"
                  required
                  value={cpForm.name}
                  onChange={(e) => updateCp('name', e.target.value)}
                />
              </Field>
              <Field label="Bank name" htmlFor="cp-bank">
                <input
                  id="cp-bank"
                  className="input"
                  required
                  value={cpForm.bankName}
                  onChange={(e) => updateCp('bankName', e.target.value)}
                />
              </Field>
              <Field label="ABA routing number" htmlFor="cp-routing">
                <input
                  id="cp-routing"
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
              </Field>
              <Field label="Account number" htmlFor="cp-acct">
                <input
                  id="cp-acct"
                  className="input"
                  required
                  inputMode="numeric"
                  maxLength={20}
                  value={cpForm.accountNumber}
                  onChange={(e) =>
                    updateCp('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 20))
                  }
                />
              </Field>
              <Field label="Account type" htmlFor="cp-type">
                <select
                  id="cp-type"
                  className="input"
                  value={cpForm.accountType}
                  onChange={(e) => updateCp('accountType', e.target.value)}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </Field>
            </div>
            {addCp.error && <Alert tone="error">{addCp.error}</Alert>}
            <SubmitButton busy={addCp.busy} busyLabel="Saving…">
              Save account
            </SubmitButton>
          </form>
        )}

        {counterparties.length > 0 ? (
          <div className="card mb-4 overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pine-50">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Bank</th>
                  <th className="p-3 text-left">Account</th>
                  <th className="p-3 text-right"></th>
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
            <p className="mb-4 text-sm text-pine-700">
              No external accounts on file. Add one above to initiate ACH transfers.
            </p>
          )
        )}
      </div>

      {/* ACH transfer form */}
      <form onSubmit={handleSubmitRequest} className="space-y-4">
        <Field label="From account (Pine Truist Finance Bank)" htmlFor="ach-from">
          <AccountSelect
            id="ach-from"
            accounts={accounts}
            value={form.sourceAccountId}
            onChange={(v) => updateForm('sourceAccountId', v)}
          />
        </Field>
        <Field label="External account (counterparty)" htmlFor="ach-cp">
          <select
            id="ach-cp"
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
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Direction" htmlFor="ach-dir">
            <select
              id="ach-dir"
              className="input"
              value={form.direction}
              onChange={(e) => updateForm('direction', e.target.value)}
            >
              <option value="credit">Credit (send money out)</option>
              <option value="debit">Debit (pull money in)</option>
            </select>
          </Field>
          <Field label="SEC code" htmlFor="ach-sec">
            <select
              id="ach-sec"
              className="input"
              value={form.secCode}
              onChange={(e) => updateForm('secCode', e.target.value)}
            >
              <option value="PPD">PPD — Personal</option>
              <option value="CCD">CCD — Business</option>
              <option value="WEB">WEB — Internet-initiated</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Amount (USD)" htmlFor="ach-amount">
            <AmountInput
              id="ach-amount"
              value={form.amount}
              onChange={(v) => updateForm('amount', v)}
            />
          </Field>
          <Field label="Effective date" htmlFor="ach-date">
            <input
              id="ach-date"
              className="input"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={form.effectiveDate}
              onChange={(e) => updateForm('effectiveDate', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Memo (optional)" htmlFor="ach-memo">
          <input
            id="ach-memo"
            className="input"
            maxLength={140}
            value={form.memo}
            onChange={(e) => updateForm('memo', e.target.value)}
          />
        </Field>
        {transfer.error && <Alert tone="error">{transfer.error}</Alert>}
        {transfer.result && (
          <Alert tone="success">
            ACH initiated.{' '}
            <span className="badge bg-pine-100 text-pine-800">{transfer.result.status}</span>{' '}
            Reference: <span className="font-mono">{transfer.result.transactionId}</span>
          </Alert>
        )}
        <SubmitButton
          busy={transfer.busy}
          className="w-full"
          disabled={counterparties.length === 0}
        >
          Submit ACH
        </SubmitButton>
        {counterparties.length === 0 && (
          <p className="text-center text-xs text-pine-700">
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
// Transfer panel (embeddable in the Move Money flow)
// ─────────────────────────────────────────
const SUB_TABS = [
  { key: 'internal', label: 'Between my accounts' },
  { key: 'ach', label: 'ACH (external)' },
];

export function TransferPanel({ accounts }) {
  const [tab, setTab] = useState('internal');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-pine-700 text-white' : 'text-pine-800 hover:bg-pine-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'internal' && <InternalTab accounts={accounts} />}
      {tab === 'ach' && <AchTab accounts={accounts} />}
    </div>
  );
}
