import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { BrandLogo } from '../components/Brand.jsx';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const registered = new URLSearchParams(location.search).get('registered') === '1';

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login({ username, password });
      const isInternal = (user.roles || []).some((r) =>
        ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'].includes(r),
      );
      const returnTo = location.state?.returnTo;
      if (returnTo && isInternal) {
        nav(returnTo, { replace: true });
      } else {
        nav('/', { replace: true });
      }
    } catch (err) {
      if (err.code === 'mfa_required') {
        nav('/login/verify', { state: { username, password, remember } });
      } else {
        setError(err.detail || err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="container-pine flex items-center justify-between py-4">
          <Link to="/" aria-label="Pine Truist Finance Bank home">
            <BrandLogo variant="light" />
          </Link>
          <div className="text-sm text-slate-600">
            New to Pine Truist?{' '}
            <Link className="font-semibold text-pine-700 hover:text-pine-900" to="/register">
              Open an account
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-pine grid items-center gap-12 py-12 lg:grid-cols-2 lg:py-16">
          {/* Sign-in card */}
          <section className="order-2 mx-auto w-full max-w-md lg:order-1">
            <h1 className="text-3xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-2 text-[15px] text-slate-600">
              Welcome back. Use your Pine Truist username and password to continue to online
              banking.
            </p>

            {registered && (
              <div className="mt-6 rounded-lg border border-pine-200 bg-pine-50 px-4 py-3 text-sm text-pine-800">
                ✓ Your account was created. Sign in to continue.
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="login-username">
                  Username
                </label>
                <input
                  id="login-username"
                  className="input"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label className="label mb-0" htmlFor="login-password">
                    Password
                  </label>
                  <Link to="#" className="text-xs font-semibold text-pine-700 hover:text-pine-900">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    className="input pr-16"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-pine-700 focus:ring-pine-500"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember this device
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Protected by multi-factor authentication and 256-bit encryption. By signing in, you
              agree to our{' '}
              <a href="#" className="link-quiet">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="link-quiet">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* Marketing side panel — clean, no fake mockup */}
          <aside className="order-1 hidden rounded-3xl bg-pine-900 p-10 text-white lg:order-2 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
              Pine Truist online banking
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-snug">
              One sign-in for every Pine Truist account.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-7 text-pine-100">
              Check balances, move money, manage cards, and review activity from a single, secure
              dashboard. Your sign-in is protected by multi-factor authentication and continuous
              fraud monitoring.
            </p>
            <ul className="mt-8 space-y-4 text-[15px]">
              {[
                'View all checking, savings, and business accounts together',
                'Send transfers and ACH with same-day visibility',
                'Receive real-time alerts on every transaction',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-1 grid h-6 w-6 flex-none place-items-center rounded-full bg-white/10 text-pine-100">
                    ✓
                  </span>
                  <span className="text-pine-50">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-pine-100">
              Pine Truist Finance Bank will never ask for your password, full SSN, or one-time codes
              by email, text, or phone. Report suspicious messages to
              security@pinetruistfinancebank.com.
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="container-pine flex flex-col items-start justify-between gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Pine Truist Finance Bank, N.A. Member FDIC.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-700">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-700">
              Terms
            </a>
            <a href="#" className="hover:text-slate-700">
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
