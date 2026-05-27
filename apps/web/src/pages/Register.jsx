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
          : 'bg-pine-600';

  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${n <= score ? color : 'bg-pine-100'}`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-pine-600">{label}</p>
        <div className="flex gap-3 text-xs text-red-500">
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

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center mb-8 gap-2">
      {Array.from({ length: total }, (_, i) => {
        const s = i + 1;
        const done = s < current;
        const active = s === current;
        return (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 transition-all ${
                done
                  ? 'bg-pine-700 border-pine-700 text-white'
                  : active
                    ? 'bg-white border-pine-700 text-pine-700'
                    : 'bg-white border-pine-200 text-pine-400'
              }`}
            >
              {done ? '✓' : s}
            </div>
            {s < total && (
              <div
                className={`h-0.5 w-12 sm:w-20 mx-1 transition-colors ${done ? 'bg-pine-700' : 'bg-pine-100'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
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
  if (!f.password || f.password.length < 12) {
    e.password = 'Password must be at least 12 characters.';
  } else if (
    [/[A-Z]/, /[a-z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(f.password)).length < 4
  ) {
    e.password = 'Must include uppercase, lowercase, digit, and symbol.';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(224,185,74,0.24),_transparent_28%),linear-gradient(135deg,_#07111f_0%,_#10243c_50%,_#123524_100%)] flex flex-col">
      {/* Header */}
      <header className="px-6 py-5">
        <Link to="/">
          <BrandLogo variant="dark" />
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 grid xl:grid-cols-[0.85fr_1.15fr] items-center gap-8 px-4 pb-12 mx-auto max-w-6xl w-full">
        <div className="hidden xl:block text-white">
          <p className="inline-flex rounded-full border border-gold-400/40 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-5">
            Account Application
          </p>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Open your account in minutes
          </h2>
          <p className="text-slate-200 leading-relaxed">
            Our secure application process collects the information required for identity
            verification and regulatory compliance. Your personal data is encrypted end-to-end and
            protected by bank-grade security throughout the application process.
          </p>
          <div className="mt-8 space-y-3">
            {['Identity Verification', 'Encrypted Data Storage', 'Instant Account Activation'].map(
              (item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
        <div className="w-full max-w-2xl bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 mx-auto ring-1 ring-white/40">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-pine-900">Account Application</h1>
            <p className="text-sm text-gray-500 mt-1">
              Step {step} of 4 — {STEP_LABELS[step - 1]} Information
            </p>
          </div>

          <StepIndicator current={step} total={4} />

          {/* ── STEP 1: Personal Info ─────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-pine-900">Personal information</h2>
              <p className="text-sm text-gray-600">
                Please provide your legal information as it appears on government-issued
                identification.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="r-name">
                    Full legal name
                  </label>
                  <input
                    id="r-name"
                    className="input"
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
                    Phone (E.164)
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
                    value={form.addressLine1}
                    onChange={(e) => upd('addressLine1', e.target.value)}
                  />
                  <FieldError msg={errors.addressLine1} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="r-addr2">
                    Apt / Suite (optional)
                  </label>
                  <input
                    id="r-addr2"
                    className="input"
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
                    Social Security Number
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
                  <p className="text-xs text-pine-600 mt-1">
                    Required for identity verification. Masked for security.
                  </p>
                  <FieldError msg={errors.ssn} />
                </div>
                <div>
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
                  <p className="text-xs text-pine-600 mt-1">
                    Your online banking username (cannot be changed)
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

          {/* ── STEP 2: Security ─────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-pine-900">Account security</h2>
              <p className="text-sm text-gray-600">
                Set up your password and security question to protect your account.
              </p>
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
                <p className="text-xs text-pine-600 mt-1">
                  Used for account recovery. Case-insensitive.
                </p>
                <FieldError msg={errors.securityAnswer} />
              </div>
              <div className="p-4 bg-pine-50 rounded-xl ring-1 ring-pine-100 text-sm">
                <p className="font-semibold text-pine-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-pine-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Multi-Factor Authentication
                </p>
                <p className="text-pine-700 mt-1">
                  For added security, you can enable two-factor authentication after account
                  creation through your account settings.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Account Type ─────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-pine-900">Select account type</h2>
              <p className="text-sm text-gray-600">
                Choose the account that best fits your financial needs.
              </p>
              <FieldError msg={errors.accountType} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    type: 'checking',
                    title: 'Personal Checking',
                    desc: 'Everyday banking with no monthly fees, free transfers, and instant access to your funds.',
                    iconPath:
                      'M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
                  },
                  {
                    type: 'savings',
                    title: 'Savings Account',
                    desc: 'High-yield savings account to help you reach your financial goals with competitive interest rates.',
                    iconPath: 'M3 3v18h18M7 16l4-4 4 4 4-6',
                  },
                  {
                    type: 'business',
                    title: 'Business Account',
                    desc: 'Full-featured business banking with ACH, wire transfers, and multi-user access controls.',
                    iconPath:
                      'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11',
                  },
                ].map(({ type, title, desc, iconPath }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => upd('accountType', type)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${
                      form.accountType === type
                        ? 'border-pine-700 bg-pine-50 shadow-sm'
                        : 'border-pine-100 bg-white hover:border-pine-300'
                    }`}
                  >
                    <svg
                      className="w-8 h-8 text-pine-700"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={iconPath} />
                    </svg>
                    <p className="font-bold text-pine-900 mt-2">{title}</p>
                    <p className="text-xs text-pine-700 mt-1">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: Review ───────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-pine-900">Review and submit</h2>
              <p className="text-sm text-gray-600">
                Please review your information before submitting your application.
              </p>
              <dl className="bg-pine-50 rounded-xl ring-1 ring-pine-100 p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
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
                    form.accountType.charAt(0).toUpperCase() + form.accountType.slice(1),
                  ],
                ].map(([lbl, val]) => (
                  <>
                    <dt key={`dt-${lbl}`} className="font-medium text-pine-700">
                      {lbl}
                    </dt>
                    <dd key={`dd-${lbl}`} className="text-pine-900 break-all">
                      {val}
                    </dd>
                  </>
                ))}
              </dl>

              <div className="p-4 bg-amber-50 ring-1 ring-amber-200 rounded-xl text-sm text-amber-900">
                <p className="font-semibold mb-1">Important Disclosures</p>
                <p>
                  By submitting this application, you agree to Pine Truist Finance Bank&apos;s{' '}
                  <a href="#" className="underline font-medium">
                    Terms of Service
                  </a>
                  ,{' '}
                  <a href="#" className="underline font-medium">
                    Privacy Policy
                  </a>
                  , and{' '}
                  <a href="#" className="underline font-medium">
                    Electronic Consent Agreement
                  </a>
                  . Member FDIC. Your deposits are insured up to $250,000 per depositor.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-pine-300 text-pine-700 focus:ring-pine-500"
                  checked={form.agreedToTerms}
                  onChange={(e) => upd('agreedToTerms', e.target.checked)}
                />
                <span className="text-sm text-pine-800">
                  I have read and agree to the Terms of Service, Privacy Policy, and Electronic
                  Consent Agreement.
                </span>
              </label>
              <FieldError msg={errors.agreedToTerms} />

              {serverError && (
                <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg p-3">
                  {serverError}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 gap-4">
            {step > 1 ? (
              <button type="button" className="btn-secondary flex-1" onClick={back} disabled={busy}>
                ← Back
              </button>
            ) : (
              <Link to="/login" className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
            )}
            {step < 4 ? (
              <button type="button" className="btn-primary flex-1" onClick={advance}>
                Continue →
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={submit}
                disabled={busy || !form.agreedToTerms}
              >
                {busy ? 'Opening account…' : 'Open my account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
