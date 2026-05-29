import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, AsyncBoundary } from '../components/ui.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import { TransferPanel } from './Transfer.jsx';
import { WirePanel } from './Wire.jsx';
import { DepositPanel } from './Deposit.jsx';
import { WithdrawPanel } from './Withdraw.jsx';

/**
 * Unified "Move Money" flow. Replaces four near-identical full-page routes with
 * a single shell that loads the customer's accounts once and renders the chosen
 * action as a tab. Each tab maps to a deep-linkable route so existing
 * bookmarks (/transfer, /wire, /deposit, /withdraw) keep working.
 */
const TABS = [
  {
    key: 'transfer',
    path: '/transfer',
    label: 'Transfer',
    blurb: 'Move money between your accounts or to an external bank via ACH.',
  },
  {
    key: 'wire',
    path: '/wire',
    label: 'Wire',
    blurb: 'Send a domestic Fedwire with same-day settlement before the 4 PM ET cutoff.',
  },
  {
    key: 'deposit',
    path: '/deposit',
    label: 'Deposit',
    blurb: 'View funding instructions and recent incoming deposits.',
  },
  {
    key: 'withdraw',
    path: '/withdraw',
    label: 'Withdraw',
    blurb: 'Request a withdrawal. Funds are held pending until approved.',
  },
];

function tabForPath(pathname) {
  return TABS.find((t) => pathname.startsWith(t.path)) || TABS[0];
}

export function MoveMoney() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = tabForPath(location.pathname);
  const { accounts, loading, error, reload } = useAccounts();

  return (
    <div className="space-y-6">
      <PageHeader title="Move money" subtitle={active.blurb} />

      {/* Segmented tab control */}
      <div
        role="tablist"
        aria-label="Money movement actions"
        className="flex flex-wrap gap-1 rounded-2xl bg-pine-100/70 p-1"
      >
        {TABS.map((t) => {
          const isActive = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => navigate(t.path)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-white text-pine-900 shadow-sm' : 'text-pine-700 hover:text-pine-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={accounts.length === 0}
        empty="You don't have any accounts yet."
      >
        <div className={active.key === 'wire' || active.key === 'transfer' ? 'card' : ''}>
          {active.key === 'transfer' && <TransferPanel accounts={accounts} />}
          {active.key === 'wire' && <WirePanel accounts={accounts} />}
          {active.key === 'deposit' && <DepositPanel accounts={accounts} />}
          {active.key === 'withdraw' && <WithdrawPanel accounts={accounts} />}
        </div>
      </AsyncBoundary>
    </div>
  );
}
