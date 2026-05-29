import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

/**
 * MFA challenge step — rendered ONLY when /login redirects here after
 * a successful username+password check that returns `mfa_required`.
 * The credentials are passed via React Router location.state (memory-only).
 */
export function MfaVerify() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const creds = location.state;

  // Guard: if no in-flight credentials, redirect back to /login
  if (!creds || !creds.username) {
    nav('/login', { replace: true });
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login({
        username: creds.username,
        password: creds.password,
        mfaCode: code,
      });
      const isInternal = (user.roles || []).some((r) =>
        ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'].includes(r),
      );
      nav(isInternal && location.state?.returnTo ? location.state.returnTo : '/', {
        replace: true,
      });
    } catch (err) {
      setError(err.detail || err.message || 'Invalid code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔐</span>
          <div>
            <h1 className="text-xl font-bold text-pine-900">Two-step verification</h1>
            <p className="text-sm text-pine-700">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="mfa-code">
              Authenticator code
            </label>
            <input
              id="mfa-code"
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <div className="mt-4 text-sm text-pine-700">
          <Link to="/login" className="hover:text-pine-900">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
