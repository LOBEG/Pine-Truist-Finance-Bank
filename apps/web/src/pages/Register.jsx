import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      nav('/login?registered=1');
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-pine-900 mb-1">Open an account</h1>
        <p className="text-sm text-pine-700 mb-6">Pine Truist Finance Bank, member FDIC. Equal Housing Lender.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={12}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            <p className="text-xs text-pine-700 mt-1">
              Minimum 12 characters, with upper/lowercase, a digit, and a symbol.
            </p>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <div className="text-sm text-pine-700 mt-4">
          Already a customer?{' '}
          <Link className="text-pine-800 font-semibold" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
