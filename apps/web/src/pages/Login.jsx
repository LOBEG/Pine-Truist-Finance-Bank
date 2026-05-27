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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(58,143,92,0.35),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#10243c_52%,_#123524_100%)] flex flex-col">
      {/* Header */}
      <header className="px-6 py-5">
        <Link to="/">
          <BrandLogo variant="dark" />
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 grid lg:grid-cols-2 items-center gap-10 px-4 pb-12 mx-auto max-w-6xl w-full">
        <div className="hidden lg:block text-white">
          <p className="inline-flex rounded-full border border-gold-400/40 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-5">
            Secure Login
          </p>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Access your account with confidence
          </h2>
          <p className="text-slate-200 max-w-lg leading-relaxed">
            Your Pine Truist account is protected by industry-leading security measures including
            encrypted connections, multi-factor authentication, and continuous fraud monitoring.
            Every login is verified to ensure your financial information stays safe.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg text-center">
            {['256-bit Encryption', 'Fraud Detection', 'Session Security'].map((item) => (
              <div key={item} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <span className="text-sm font-bold">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 mx-auto ring-1 ring-white/40">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-pine-900">Sign In</h1>
            <p className="text-sm text-gray-500 mt-1">Access your Pine Truist account securely</p>
          </div>

          {registered && (
            <div className="mb-4 text-sm text-pine-800 bg-pine-50 ring-1 ring-pine-200 rounded-lg p-3">
              ✓ Account created successfully! Please sign in to continue.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="login-username"
              >
                Username
              </label>
              <input
                id="login-username"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-100"
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
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="login-password">
                  Password
                </label>
                <Link to="#" className="text-xs text-pine-600 hover:text-pine-800">
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-100"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                className="rounded border-gray-300 text-pine-700 focus:ring-pine-500"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Remember this device
              </label>
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            <button
              className="w-full bg-[#3a8f5c] hover:bg-[#2f7a4d] text-white font-bold py-3 rounded-lg text-sm transition"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <span>Don&apos;t have an account? </span>
            <Link className="text-pine-700 font-semibold hover:text-pine-900" to="/register">
              Open an Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
