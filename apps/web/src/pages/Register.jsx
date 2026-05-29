import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { BrandLogo } from '../components/Brand.jsx';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your elementary school?',
  'What was the make of your first car?',
];

const STEP_LABELS = ['Personal', 'Security', 'Account', 'Review'];

const INITIAL = {
  fullName: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  ssn: '',
  username: '',
  password: '',
  confirmPassword: '',
  securityQuestion: SECURITY_QUESTIONS[0],
  securityAnswer: '',
  accountType: '',
  agreedToTerms: false,
};

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function PasswordStrength({ password }) {
  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';
  const color =
    score <= 1
      ? 'bg-red-500'
      : score <= 3
        ? 'bg-amber-500'
        : score === 4
          ? 'bg-pine-400'
          : 'bg-pine-700';

  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${n <= score ? color : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <p className="font-semibold text-slate-700">{label}</p>
        <div className="flex flex-wrap gap-3 text-slate-500">
          {!checks.length && <span>12+ chars</span>}
          {!checks.upper && <span>Uppercase</span>}
          {!checks.lower && <span>Lowercase</span>}
          {!checks.digit && <span>Digit</span>}
          {!checks.symbol && <span>Symbol</span>}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current, total, labels }) {
  return (
    <ol className="mb-8 grid grid-cols-4 gap-2">
      {Array.from({ length: total }, (_, i) => {
        const s = i + 1;
        const done = s < current;
        const active = s === current;
        return (
          <li key={s} className="flex flex-col gap-2">
            <div
              className={`h-1.5 rounded-full ${
                done ? 'bg-pine-700' : active ? 'bg-pine-700' : 'bg-slate-200'
              }`}
            />
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-pine-700 text-white'
                    : active
                      ? 'bg-pine-700 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? '✓' : s}
              </span>
              <span
                className={`font-semibold ${active || done ? 'text-slate-900' : 'text-slate-400'}`}
              >
                {labels[i]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function validateStep1(f) {
  const e = {};
  if (!f.fullName || f.fullName.trim().length < 2)
    e.fullName = 'Full name is required (min 2 chars).';
  if (!f.dateOfBirth) e.dateOfBirth = 'Date of birth is required.';
  if (!f.phone || !/^\+[1-9]\d{6,14}$/.test(f.phone))
    e.phone = 'Enter E.164 format, e.g. +12125551234.';
  if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Valid email required.';
  if (!f.addressLine1) e.addressLine1 = 'Street address is required.';
  if (!f.city) e.city = 'City is required.';
  if (!f.state || f.state.length !== 2) e.state = '2-letter state code required.';
  if (!f.postalCode || !/^\d{5}(-\d{4})?$/.test(f.postalCode))
    e.postalCode = 'Valid ZIP required (e.g. 10001).';
  if (!f.ssn || !/^\d{9}$/.test(f.ssn)) e.ssn = 'SSN must be 9 digits (no dashes).';
  if (!f.username || !/^[a-zA-Z0-9._-]{4,32}$/.test(f.username))
    e.username = 'Username: 4–32 chars, letters/digits/. -_ only.';
  if (!f.password) {
    e.password = 'Password is required.';
  }
  return e;
}

function validateStep2(f) {
  const e = {};
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match.';
  if (!f.securityAnswer || !f.securityAnswer.trim())
    e.securityAnswer = 'Security answer is required.';
  return e;
}

function validateStep3(f) {
  const e = {};
  if (!f.accountType) e.accountType = 'Please select an account type.';
  return e;
}

const ACCOUNT_TYPES = [
  {
    type: 'checking',
    title: 'Personal Checking',
    rate: 'No monthly fee',
    desc: 'Everyday spending with debit card, mobile deposit, and same-day transfers.',
  },
  {
    type: 'savings',
    title: 'High-Yield Savings',
    rate: '4.40% APY',
    desc: 'Earn competitive interest with no minimum balance and unlimited internal transfers.',
  },
  {
    type: 'business',
    title: 'Business Banking',
    rate: 'For owners',
    desc: 'ACH, wires, and multi-user permissions designed for small and growing businesses.',
  },
];

export function Register() {
  const { register, login } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ssnFocused, setSsnFocused] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function advance() {
    let errs = {};
    if (step === 1) errs = validateStep1(form);
    else if (step === 2) errs = validateStep2(form);
    else if (step === 3) errs = validateStep3(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  function back() {
    setErrors({});
    setStep((s) => s - 1);
  }

  async function submit() {
    if (!form.agreedToTerms) {
      setErrors({ agreedToTerms: 'You must agree to the Terms before submitting.' });
      return;
    }
    setServerError(null);
    setBusy(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth,
        phone: form.phone,
        email: form.email,
        addressLine1: form.addressLine1,
        ...(form.addressLine2 ? { addressLine2: form.addressLine2 } : {}),
        city: form.city,
        state: form.state.toUpperCase(),
        postalCode: form.postalCode,
        ssn: form.ssn,
        username: form.username,
        password: form.password,
        securityQuestion: form.securityQuestion,
        securityAnswer: form.securityAnswer.trim(),
        accountType: form.accountType,
      });
      await login({ username: form.username, password: form.password });
      nav('/onboarding/complete', { replace: true });
    } catch (err) {
      setServerError(err.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  const ssnDisplay = !ssnFocused && form.ssn.length >= 5 ? `•••-••-${form.ssn.slice(5)}` : form.ssn;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="container-pine flex items-center justify-between py-4">
          <Link to="/" aria-label="Pine Truist Finance Bank home">
            <BrandLogo variant="light" />
          </Link>
          <div className="text-sm text-slate-600">
            Already a customer?{' '}
            <Link to="/login" className="font-semibold text-pine-700 hover:text-pine-900">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-pine grid gap-10 py-10 lg:grid-cols-[1fr_1.4fr] lg:py-14">
          {/* Sidebar marketing */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl bg-pine-900 p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
                Open an account
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-snug">
                A few minutes to a modern bank account.
              </h1>
              <p className="mt-4 text-[15px] leading-7 text-pine-100">
                Apply online for personal or business banking. You will need a valid ID, Social
                Security number, and U.S. mailing address.
              </p>
              <ol className="mt-8 space-y-4 text-[15px]">
                {[
                  ['Personal information', 'Tell us who you are and where you live.'],
                  ['Account security', 'Set your password and recovery question.'],
                  ['Choose your account', 'Pick checking, savings, or business.'],
                  ['Review and submit', 'Confirm details and accept disclosures.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/10 text-sm font-bold text-gold-400">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{t}</p>
                      <p className="text-sm text-pine-100">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-pine-100">
                Your data is encrypted in transit and at rest. Pine Truist Finance Bank is a Member
                FDIC. Deposits are insured up to $250,000 per depositor.
              </div>
            </div>
          </aside>

          {/* Form */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="mb-6">
              <p className="eyebrow">Account application</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Open your Pine Truist account
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Step {step} of 4 — {STEP_LABELS[step - 1]} information
              </p>
            </div>

            <StepIndicator current={step} total={4} labels={STEP_LABELS} />

            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Personal information</h3>
                  <p className="text-sm text-slate-600">
                    Provide your legal information as it appears on government-issued ID.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-name">
                      Full legal name
                    </label>
                    <input
                      id="r-name"
                      className="input"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => upd('fullName', e.target.value)}
                    />
                    <FieldError msg={errors.fullName} />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-dob">
                      Date of birth
                    </label>
                    <input
                      id="r-dob"
                      className="input"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => upd('dateOfBirth', e.target.value)}
                    />
                    <FieldError msg={errors.dateOfBirth} />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-phone">
                      Phone number
                    </label>
                    <input
                      id="r-phone"
                      className="input"
                      type="tel"
                      placeholder="+12125551234"
                      value={form.phone}
                      onChange={(e) => upd('phone', e.target.value)}
                    />
                    <FieldError msg={errors.phone} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-email">
                      Email address
                    </label>
                    <input
                      id="r-email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => upd('email', e.target.value)}
                    />
                    <FieldError msg={errors.email} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-addr1">
                      Street address
                    </label>
                    <input
                      id="r-addr1"
                      className="input"
                      autoComplete="address-line1"
                      value={form.addressLine1}
                      onChange={(e) => upd('addressLine1', e.target.value)}
                    />
                    <FieldError msg={errors.addressLine1} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-addr2">
                      Apt / suite (optional)
                    </label>
                    <input
                      id="r-addr2"
                      className="input"
                      autoComplete="address-line2"
                      value={form.addressLine2}
                      onChange={(e) => upd('addressLine2', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-city">
                      City
                    </label>
                    <input
                      id="r-city"
                      className="input"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) => upd('city', e.target.value)}
                    />
                    <FieldError msg={errors.city} />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-state">
                      State
                    </label>
                    <input
                      id="r-state"
                      className="input"
                      maxLength={2}
                      placeholder="NY"
                      value={form.state}
                      onChange={(e) => upd('state', e.target.value.toUpperCase())}
                    />
                    <FieldError msg={errors.state} />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-zip">
                      ZIP code
                    </label>
                    <input
                      id="r-zip"
                      className="input"
                      placeholder="10001"
                      value={form.postalCode}
                      onChange={(e) => upd('postalCode', e.target.value)}
                    />
                    <FieldError msg={errors.postalCode} />
                  </div>
                  <div>
                    <label className="label" htmlFor="r-ssn">
                      Social Security number
                    </label>
                    <input
                      id="r-ssn"
                      className="input font-mono tracking-widest"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="123456789"
                      value={ssnDisplay}
                      onFocus={() => setSsnFocused(true)}
                      onBlur={() => setSsnFocused(false)}
                      onChange={(e) => upd('ssn', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Required for identity verification. Masked while not focused.
                    </p>
                    <FieldError msg={errors.ssn} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-user">
                      Username
                    </label>
                    <input
                      id="r-user"
                      className="input"
                      autoComplete="username"
                      value={form.username}
                      onChange={(e) => upd('username', e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Your online banking username. This cannot be changed later.
                    </p>
                    <FieldError msg={errors.username} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="r-pw">
                      Password
                    </label>
                    <input
                      id="r-pw"
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => upd('password', e.target.value)}
                    />
                    <PasswordStrength password={form.password} />
                    <FieldError msg={errors.password} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Account security</h3>
                  <p className="text-sm text-slate-600">
                    Confirm your password and set a recovery question. You can enable two-factor
                    authentication once your account is open.
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="r-confirm">
                    Confirm password
                  </label>
                  <input
                    id="r-confirm"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => upd('confirmPassword', e.target.value)}
                  />
                  <FieldError msg={errors.confirmPassword} />
                </div>
                <div>
                  <label className="label" htmlFor="r-sq">
                    Security question
                  </label>
                  <select
                    id="r-sq"
                    className="input"
                    value={form.securityQuestion}
                    onChange={(e) => upd('securityQuestion', e.target.value)}
                  >
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="r-sa">
                    Your answer
                  </label>
                  <input
                    id="r-sa"
                    className="input"
                    autoComplete="off"
                    value={form.securityAnswer}
                    onChange={(e) => upd('securityAnswer', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Used for account recovery. Answers are case-insensitive.
                  </p>
                  <FieldError msg={errors.securityAnswer} />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Multi-factor authentication</p>
                  <p className="mt-1">
                    For added security, you can enable two-factor authentication after account
                    creation from your account settings.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Choose your account</h3>
                  <p className="text-sm text-slate-600">
                    Select the account that best fits your needs. You can add more accounts later.
                  </p>
                </div>
                <FieldError msg={errors.accountType} />
                <div className="grid grid-cols-1 gap-3">
                  {ACCOUNT_TYPES.map(({ type, title, rate, desc }) => {
                    const active = form.accountType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => upd('accountType', type)}
                        className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                          active
                            ? 'border-pine-700 bg-pine-50 ring-2 ring-pine-200'
                            : 'border-slate-200 bg-white hover:border-pine-300'
                        }`}
                      >
                        <span
                          className={`mt-1 grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${
                            active ? 'border-pine-700 bg-pine-700 text-white' : 'border-slate-300'
                          }`}
                          aria-hidden="true"
                        >
                          {active && '✓'}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-900">{title}</p>
                            <span className="text-xs font-semibold text-pine-700">{rate}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Review and submit</h3>
                  <p className="text-sm text-slate-600">
                    Please confirm your information before submitting your application.
                  </p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
                  {[
                    ['Full name', form.fullName],
                    ['Date of birth', form.dateOfBirth],
                    ['Phone', form.phone],
                    ['Email', form.email],
                    [
                      'Address',
                      [form.addressLine1, form.addressLine2, form.city, form.state, form.postalCode]
                        .filter(Boolean)
                        .join(', '),
                    ],
                    ['SSN', `•••-••-${form.ssn.slice(5)}`],
                    ['Username', form.username],
                    [
                      'Account type',
                      form.accountType
                        ? form.accountType.charAt(0).toUpperCase() + form.accountType.slice(1)
                        : '',
                    ],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="contents">
                      <dt className="font-semibold text-slate-500">{lbl}</dt>
                      <dd className="break-all text-slate-900">{val}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Important disclosures</p>
                  <p className="mt-1">
                    By submitting this application you agree to our{' '}
                    <a href="#" className="font-semibold underline">
                      Terms of Service
                    </a>
                    ,{' '}
                    <a href="#" className="font-semibold underline">
                      Privacy Policy
                    </a>
                    , and{' '}
                    <a href="#" className="font-semibold underline">
                      Electronic Consent Agreement
                    </a>
                    . Member FDIC. Deposits insured up to $250,000 per depositor.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-pine-700 focus:ring-pine-500"
                    checked={form.agreedToTerms}
                    onChange={(e) => upd('agreedToTerms', e.target.checked)}
                  />
                  I have read and agree to the Terms of Service, Privacy Policy, and Electronic
                  Consent Agreement.
                </label>
                <FieldError msg={errors.agreedToTerms} />

                {serverError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {serverError}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-10 flex justify-between gap-3 border-t border-slate-200 pt-6">
              {step > 1 ? (
                <button type="button" className="btn-secondary" onClick={back} disabled={busy}>
                  ← Back
                </button>
              ) : (
                <Link to="/login" className="btn-secondary">
                  Cancel
                </Link>
              )}
              {step < 4 ? (
                <button type="button" className="btn-primary" onClick={advance}>
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submit}
                  disabled={busy || !form.agreedToTerms}
                >
                  {busy ? 'Opening account…' : 'Open my account'}
                </button>
              )}
            </div>
          </section>
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
