import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
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
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-block w-7 h-7 rounded-lg bg-pine-50 text-pine-800 grid place-items-center font-extrabold">
            P
          </span>
          Pine Truist Finance Bank
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
  if (!user) return <Navigate to="/login" replace />;
  const isInternal = roles.some((r) =>
    ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'].includes(r),
  );
  if (!isInternal) return <Navigate to="/" replace />;
  return children;
}

function InternalLoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Loading secure console…</div>
    </div>
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
        {/* Internal Operations Dashboard — separate layout, code-split */}
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
        <Route
          path="/*"
          element={
            <>
              <CustomerHeader />
              <main className="mx-auto max-w-6xl px-4 py-8">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/"
                    element={
                      <RequireAuth>
                        <Dashboard />
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
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
