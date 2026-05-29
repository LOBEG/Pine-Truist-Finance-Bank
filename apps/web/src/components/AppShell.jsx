import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { useNotifications } from '../store/notifications.js';
import { useRealtime } from '../realtime/socket.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { formatMoney } from '../api/format.js';
import { BrandLogo } from './Brand.jsx';

const REALTIME_NOTIF_EVENTS = [
  'transaction.posted',
  'transaction.created',
  'transaction.flagged',
  'balance.updated',
  'withdrawal.approved',
  'withdrawal.rejected',
];

const NAV = [
  { to: '/', label: 'Accounts', icon: '🏦', end: true },
  { to: '/move', label: 'Move money', icon: '💸' },
  { to: '/transactions', label: 'Transactions', icon: '📊' },
  { to: '/deposit', label: 'Deposit', icon: '📥' },
  { to: '/notifications', label: 'Alerts', icon: '🔔', badge: true },
];

function NavItems({ onNavigate }) {
  const { unread } = useNotifications();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-pine-700 text-white shadow-sm'
                : 'text-pine-100/90 hover:bg-pine-700/60 hover:text-white'
            }`
          }
        >
          <span aria-hidden="true" className="text-base leading-none">
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {item.badge && unread > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * AppShell — persistent authenticated layout (sidebar + topbar) with the
 * customer's account context always in view. Replaces the per-page header and
 * the duplicated layout/data-fetching that lived in main.jsx.
 */
export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { push } = useNotifications();
  const { totalAvailable } = useAccounts();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const notifHandlers = useMemo(
    () =>
      REALTIME_NOTIF_EVENTS.reduce((acc, ev) => {
        acc[ev] = (payload) => push(ev, payload);
        return acc;
      }, {}),
    [push],
  );
  useRealtime(notifHandlers);

  async function handleSignOut() {
    await logout();
    nav('/login');
  }

  if (!user) return children;

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-pine-800 p-4 text-white">
      <Link to="/" className="flex items-center gap-2 px-1" onClick={() => setMobileOpen(false)}>
        <BrandLogo variant="dark" />
      </Link>

      <div className="rounded-2xl bg-pine-700/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-pine-200">Total available</p>
        <p className="mt-0.5 text-2xl font-bold">{formatMoney(totalAvailable)}</p>
      </div>

      <NavItems onNavigate={() => setMobileOpen(false)} />

      <div className="mt-auto border-t border-pine-700 pt-4">
        <p className="truncate px-1 text-sm text-pine-100">
          {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-2 w-full rounded-lg bg-pine-700 px-3 py-2 text-sm font-medium hover:bg-pine-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-pine-50/40 lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between bg-pine-800 px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 hover:bg-pine-700"
        >
          <span className="text-xl leading-none" aria-hidden="true">
            ☰
          </span>
        </button>
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo variant="dark" />
        </Link>
        <Link to="/notifications" className="relative rounded-lg p-2 hover:bg-pine-700">
          <span className="text-xl leading-none" aria-hidden="true">
            🔔
          </span>
          <MobileBadge />
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}

function MobileBadge() {
  const { unread } = useNotifications();
  if (unread <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
      {unread > 9 ? '9+' : unread}
    </span>
  );
}
