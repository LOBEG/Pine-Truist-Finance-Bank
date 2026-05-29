/**
 * Shared UI primitives for the customer banking experience.
 *
 * These components standardise the loading / empty / error states, form
 * fields, alerts and money inputs that were previously re-implemented (and
 * subtly inconsistent) across every money-movement page.
 */
import { accountTitle, formatMoney } from '../api/format.js';

/** Inline spinner used inside buttons and async boundaries. */
export function Spinner({ className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-pine-200 border-t-pine-700 ${className}`}
    />
  );
}

/**
 * Alert — consistent inline messaging.
 * tone: 'error' | 'success' | 'warning' | 'info'
 */
const ALERT_TONES = {
  error: 'text-red-700 bg-red-50 ring-red-200',
  success: 'text-pine-800 bg-pine-50 ring-pine-200',
  warning: 'text-amber-800 bg-amber-50 ring-amber-200',
  info: 'text-slate-700 bg-slate-50 ring-slate-200',
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg p-3 text-sm ring-1 ${ALERT_TONES[tone] || ALERT_TONES.info} ${className}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/**
 * AsyncBoundary — renders consistent loading, error and empty states so each
 * page doesn't hand-roll its own "Loading…" text.
 *
 * Props:
 *   loading  {boolean}
 *   error    {Error|string|null}
 *   isEmpty  {boolean}              — show the empty state when true
 *   empty    {ReactNode|string}    — empty-state content
 *   onRetry  {() => void}          — optional retry handler shown on error
 */
export function AsyncBoundary({
  loading,
  error,
  isEmpty = false,
  empty = 'Nothing to show yet.',
  onRetry,
  children,
}) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 text-pine-700" aria-busy="true">
        <Spinner />
        <span>Loading…</span>
      </div>
    );
  }
  if (error) {
    const message = typeof error === 'string' ? error : error.detail || error.message;
    return (
      <Alert tone="error" title="Something went wrong">
        <p className="mt-0.5">{message || 'Please try again.'}</p>
        {onRetry && (
          <button type="button" className="btn-secondary mt-3 text-xs" onClick={onRetry}>
            Try again
          </button>
        )}
      </Alert>
    );
  }
  if (isEmpty) {
    return <div className="card text-center text-sm text-pine-700">{empty}</div>;
  }
  return children;
}

/** PageHeader — title + optional subtitle and right-aligned actions. */
export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-pine-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-pine-700">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Field — label + control wrapper with optional hint and per-field error. */
export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-pine-700">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/**
 * AmountInput — standard USD decimal input with validation pattern.
 * Accepts the same props as <input> plus value/onChange.
 */
export function AmountInput({ value, onChange, id, required = true, ...rest }) {
  return (
    <input
      id={id}
      className="input"
      required={required}
      inputMode="decimal"
      pattern="\d+(\.\d{1,2})?"
      placeholder="0.00"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

/**
 * AccountSelect — standardised "from/to account" picker.
 *
 * Props:
 *   accounts     {Array}
 *   value        {string}
 *   onChange     {(id: string) => void}
 *   showBalance  {boolean}   — append available balance to each option
 *   exclude      {string}    — account id to omit (e.g. the chosen source)
 *   placeholder  {string}
 */
export function AccountSelect({
  accounts = [],
  value,
  onChange,
  id,
  required = true,
  showBalance = true,
  exclude,
  placeholder = 'Select…',
}) {
  const options = exclude ? accounts.filter((a) => a.id !== exclude) : accounts;
  return (
    <select
      id={id}
      required={required}
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((a) => (
        <option key={a.id} value={a.id}>
          {accountTitle(a.type)} {a.nickname} ••••{a.mask}
          {showBalance ? ` — ${formatMoney(a.balances.available_balance)}` : ''}
        </option>
      ))}
    </select>
  );
}

/** SubmitButton — primary button that shows a spinner + busy label. */
export function SubmitButton({
  busy,
  children,
  busyLabel = 'Submitting…',
  className = '',
  ...rest
}) {
  return (
    <button
      type="submit"
      className={`btn-primary ${className}`}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="border-white/40 border-t-white" />
          {busyLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
