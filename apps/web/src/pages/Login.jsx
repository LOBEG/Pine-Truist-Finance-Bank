import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

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
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-pine-900 mb-1">Welcome back</h1>
        <p className="text-sm text-pine-700 mb-6">
          Sign in to your Pine Truist Finance Bank account.
        </p>

        {registered && (
          <div className="mb-4 text-sm text-pine-800 bg-pine-50 ring-1 ring-pine-200 rounded-lg p-3">
            Account created! Sign in to get started.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="flex items-baseline justify-between mb-1">
              <label className="label mb-0" htmlFor="login-password">
                Password
              </label>
              <Link to="#" className="text-xs text-pine-700 hover:text-pine-900">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              className="rounded border-pine-300 text-pine-700 focus:ring-pine-500"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember" className="text-sm text-pine-700 cursor-pointer">
              Remember this device
            </label>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-sm text-pine-700">
          <Link to="#" className="hover:text-pine-900">
            Forgot username?
          </Link>
          <span>
            New customer?{' '}
            <Link className="text-pine-800 font-semibold" to="/register">
              Open an account
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
