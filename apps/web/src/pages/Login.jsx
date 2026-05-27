import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { BrandLogo } from '../components/Brand.jsx';

const trustItems = ['Encrypted sessions', 'MFA ready', 'Fraud monitored'];

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_15%,_rgba(224,185,74,0.20),_transparent_28%),radial-gradient(circle_at_85%_10%,_rgba(98,175,116,0.28),_transparent_30%),linear-gradient(135deg,_#06111d_0%,_#0f2b2c_48%,_#123524_100%)] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Pine Truist home">
          <BrandLogo variant="dark" />
        </Link>
        <Link to="/register" className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white/90 transition hover:bg-white/10 sm:inline-flex">
          Open account
        </Link>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-6xl items-center gap-10 px-4 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden lg:block">
          <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-pine-400/20 blur-3xl" />
          <div className="glass-panel relative p-8">
            <span className="eyebrow">Secure access</span>
            <h1 className="mt-6 max-w-xl text-5xl font-black leading-tight tracking-tight">
              Sign in to banking that keeps pace with you.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-200">
              Manage balances, transfers, cards, and alerts from a calm workspace protected by strong authentication and real-time monitoring.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {trustItems.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-white shadow-lg shadow-slate-950/10">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-slate-950/30 p-5">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Account security</span>
                <span className="rounded-full bg-pine-400/20 px-3 py-1 text-pine-100">Active</span>
              </div>
              <div className="mt-4 space-y-3">
                {['Device verification', 'Session encryption', 'Fraud signal review'].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-100">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-pine-400/20 text-pine-100">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card mx-auto w-full max-w-md p-7 sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-pine-600">Welcome back</p>
            <h2 className="mt-2 text-3xl font-black text-pine-950">Secure sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use your Pine Truist username to continue to your dashboard.</p>
          </div>

          {registered && (
            <div className="mb-4 rounded-2xl border border-pine-200 bg-pine-50 p-3 text-sm font-medium text-pine-800">
              ✓ Account created successfully. Please sign in to continue.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
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
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="label mb-0" htmlFor="login-password">
                  Password
                </label>
                <Link to="#" className="text-xs font-bold text-pine-700 hover:text-pine-900">
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                className="input"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-pine-50 px-3 py-2">
              <input
                id="remember"
                type="checkbox"
                className="rounded border-pine-300 text-pine-700 focus:ring-pine-500"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" className="cursor-pointer text-sm font-medium text-pine-800">
                Remember this device
              </label>
            </div>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in securely'}
            </button>
          </form>

          <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
            <span>New to Pine Truist? </span>
            <Link className="font-extrabold text-pine-700 hover:text-pine-900" to="/register">
              Open an account
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
