import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password, mfaCode: mfaCode || undefined });
      nav('/');
    } catch (err) {
      if (err.code === 'mfa_required') setError('Enter your authenticator code.');
      else setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-pine-900 mb-1">Welcome back</h1>
        <p className="text-sm text-pine-700 mb-6">Sign in to your Pine Bank account.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Authenticator code (if enabled)</label>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="000000"
            />
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="text-sm text-pine-700 mt-4">
          New customer?{' '}
          <Link className="text-pine-800 font-semibold" to="/register">
            Open an account
          </Link>
        </div>
      </div>
    </div>
  );
}
