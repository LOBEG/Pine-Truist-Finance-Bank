import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './store/auth.js';
import { useNotifications } from './store/notifications.js';
import { useRealtime } from './realtime/socket.js';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Transactions } from './pages/Transactions.jsx';
import { Transfer } from './pages/Transfer.jsx';
import { Wire } from './pages/Wire.jsx';
import { Deposit } from './pages/Deposit.jsx';
import { Withdraw } from './pages/Withdraw.jsx';
import { Notifications } from './pages/Notifications.jsx';
import { Landing } from './pages/Landing.jsx';
import { MfaVerify } from './pages/MfaVerify.jsx';
import { OnboardingComplete } from './pages/OnboardingComplete.jsx';
import { BrandLogo } from './components/Brand.jsx';
import './styles.css';

// Configurable internal base path (default: /ops). Never linked publicly.
const INTERNAL_BASE_PATH = import.meta.env.VITE_INTERNAL_BASE_PATH || '/ops';

// Code-split internal operations dashboard (not shipped with public bundle)
const OpsConsole = React.lazy(() => import('./internal/OpsConsole.jsx'));

const REALTIME_NOTIF_EVENTS = [
  'transaction.posted',
  'transaction.created',
  'transaction.flagged',
  'balance.updated',
  'withdrawal.approved',
  'withdrawal.rejected',
];

function CustomerHeader() {
  const { user, logout } = useAuth();
  const { unread, push } = useNotifications();
  const nav = useNavigate();

  const notifHandlers = React.useMemo(
    () =>
      REALTIME_NOTIF_EVENTS.reduce((acc, ev) => {
        acc[ev] = (payload) => push(ev, payload);
        return acc;
      }, {}),
    [push],
  );
  useRealtime(notifHandlers);

  if (!user) return null;

  return (
    <header className="bg-pine-800 text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo variant="dark" />
        </Link>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          <Link to="/" className="hover:text-pine-100">
            Accounts
          </Link>
          <Link to="/transactions" className="hover:text-pine-100">
            Transactions
          </Link>
          <Link to="/deposit" className="hover:text-pine-100">
            Deposit
          </Link>
          <Link to="/transfer" className="hover:text-pine-100">
            Transfer
          </Link>
          <Link to="/wire" className="hover:text-pine-100">
            Wire
          </Link>
          <Link to="/withdraw" className="hover:text-pine-100">
            Withdraw
          </Link>
          <Link to="/notifications" className="hover:text-pine-100 relative">
            Alerts
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <button
            onClick={async () => {
              await logout();
              nav('/login');
            }}
            className="bg-pine-700 hover:bg-pine-600 rounded-lg px-3 py-1"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-pine-700">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireInternalAuth({ children }) {
  const { user, loading, roles = [] } = useAuth();
  if (loading) return <div className="p-10 text-center text-pine-700">Loading…</div>;
  if (!user) return <Navigate to={`${INTERNAL_BASE_PATH}/login`} replace />;
  const isInternal = roles.some((r) =>
    ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'].includes(r),
  );
  if (!isInternal) return <Navigate to="/" replace />;
  return children;
}

function OpsLogin() {
  const { login, user, roles = [] } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [form, setForm] = React.useState({ username: '', password: '' });
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Already logged in with internal role → go to ops console
  React.useEffect(() => {
    if (!user) return;
    const isInternal = roles.some((r) =>
      ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'].includes(r),
    );
    nav(isInternal ? INTERNAL_BASE_PATH : '/', { replace: true });
  }, [user, roles, nav]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login({ username: form.username, password: form.password });
    } catch (err) {
      if (err?.code === 'mfa_required') {
        nav(`${INTERNAL_BASE_PATH}/verify`, {
          state: { username: form.username, password: form.password },
        });
        return;
      }
      setError(err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
        <div className="flex justify-center mb-6">
          <BrandLogo variant="dark" />
        </div>
        <h1 className="text-center font-bold text-white text-xl mb-1">Operations Console</h1>
        <p className="text-center text-slate-400 text-sm mb-6">Internal access only</p>
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pine-500"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pine-500"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-pine-700 hover:bg-pine-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm mt-2"
          >
            {busy ? 'Signing in…' : 'Sign in to Console'}
          </button>
        </form>
      </div>
    </div>
  );
}

function InternalLoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Loading secure console…</div>
    </div>
  );
}

/** Root "/" — shows Landing for unauthenticated visitors, Dashboard for logged-in users. */
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-pine-700">Loading…</div>;
  if (!user) return <Landing />;
  return <Dashboard />;
}

/**
 * Customer platform layout.
 * Full-page routes (landing, login, register) skip the constrained <main> wrapper.
 * Authenticated app routes use the CustomerHeader + constrained layout.
 */
function CustomerLayout() {
  return (
    <Routes>
      {/* Full-page routes — own layout, no max-w constraint */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/verify" element={<MfaVerify />} />
      <Route path="/register" element={<Register />} />

      {/* App routes — constrained layout with CustomerHeader */}
      <Route
        path="/*"
        element={
          <>
            <CustomerHeader />
            <main className="mx-auto max-w-6xl px-4 py-8">
              <Routes>
                <Route
                  path="/onboarding/complete"
                  element={
                    <RequireAuth>
                      <OnboardingComplete />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <RequireAuth>
                      <Transactions />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/transfer"
                  element={
                    <RequireAuth>
                      <Transfer />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/deposit"
                  element={
                    <RequireAuth>
                      <Deposit />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/wire"
                  element={
                    <RequireAuth>
                      <Wire />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RequireAuth>
                      <Notifications />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/withdraw"
                  element={
                    <RequireAuth>
                      <Withdraw />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </>
        }
      />
    </Routes>
  );
}

function App() {
  const { bootstrap } = useAuth();
  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  return (
    <BrowserRouter>
      <Routes>
        {/* Internal Operations Dashboard — ops login must be BEFORE the wildcard */}
        <Route path={`${INTERNAL_BASE_PATH}/login`} element={<OpsLogin />} />
        <Route
          path={`${INTERNAL_BASE_PATH}/*`}
          element={
            <Suspense fallback={<InternalLoadingFallback />}>
              <RequireInternalAuth>
                <OpsConsole basePath={INTERNAL_BASE_PATH} />
              </RequireInternalAuth>
            </Suspense>
          }
        />
        {/* Public Customer Platform */}
        <Route path="/*" element={<CustomerLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
