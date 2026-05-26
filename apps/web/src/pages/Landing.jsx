import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo, BrandMark } from '../components/Brand.jsx';

/* ─── Inline SVG icons (no external deps) ──────────────────────────── */

function ShieldIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7L12 2z" />
    </svg>
  );
}

function BankIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11" />
    </svg>
  );
}

function TransferIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function ChartIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 3v18h18M7 16l4-4 4 4 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function MobileIcon({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Static data ───────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BankIcon,
    title: 'Multiple Account Types',
    body: 'Checking, savings, money market, CDs, and investment accounts — all in one place.',
    color: 'text-pine-600',
  },
  {
    icon: TransferIcon,
    title: 'Instant Transfers',
    body: 'Move money between accounts or to any US bank in seconds with zero fees.',
    color: 'text-pine-600',
  },
  {
    icon: ChartIcon,
    title: 'Smart Insights',
    body: 'Real-time spending analytics and balance projections to keep you on track.',
    color: 'text-gold-500',
  },
  {
    icon: ShieldIcon,
    title: 'Bank-Grade Security',
    body: 'AES-256 encryption, MFA, anomaly detection, and FDIC-insured deposits.',
    color: 'text-pine-600',
  },
  {
    icon: MobileIcon,
    title: 'Always Available',
    body: 'Web and mobile apps with 99.9% uptime so you can bank wherever life takes you.',
    color: 'text-gold-500',
  },
  {
    icon: LockIcon,
    title: 'Privacy First',
    body: 'We never sell your data. Your financial information stays between you and your bank.',
    color: 'text-pine-600',
  },
];

const SECURITY_POINTS = [
  '256-bit AES encryption at rest and in transit',
  'Multi-factor authentication (TOTP & SMS)',
  'Behavioural anomaly detection on every login',
  'FDIC insured up to $250,000',
  'SOC 2 Type II compliant infrastructure',
  'Zero-knowledge security question storage',
];

const TRANSFER_ITEMS = [
  { label: 'ACH Transfer', fee: 'Free', time: '1–2 days' },
  { label: 'Instant Transfer', fee: 'Free', time: 'Seconds' },
  { label: 'Domestic Wire', fee: '$15', time: 'Same day' },
  { label: 'International Wire', fee: '$35', time: '1–3 days' },
  { label: 'Mobile Check Deposit', fee: 'Free', time: '1 day' },
  { label: 'Bill Pay', fee: 'Free', time: '2–5 days' },
];

const TESTIMONIALS = [
  {
    name: 'Marcus T.',
    role: 'Small Business Owner',
    quote:
      'Switched from my old bank and the difference is night and day. Wire transfers that used to take 3 days now happen same afternoon.',
  },
  {
    name: 'Priya K.',
    role: 'Graduate Student',
    quote:
      'Opening my account took ten minutes. The onboarding is smooth and the mobile app actually makes sense.',
  },
  {
    name: 'James R.',
    role: 'Freelance Designer',
    quote:
      'Love the real-time balance updates when a client payment lands. No more refreshing the page.',
  },
];

const FAQS = [
  {
    q: 'How do I open an account?',
    a: 'Click "Open an Account" and complete our 4-step online onboarding in under 10 minutes. You will need a government-issued ID and your Social Security Number.',
  },
  {
    q: 'Is my money FDIC insured?',
    a: 'Yes. All deposit accounts held at Pine Truist Finance Bank are insured by the FDIC up to the legal maximum of $250,000 per depositor, per ownership category.',
  },
  {
    q: 'How do I set up multi-factor authentication?',
    a: 'After logging in, navigate to Account Settings → Security and follow the prompts to enrol a TOTP authenticator app or SMS-based MFA.',
  },
  {
    q: 'What account types are available?',
    a: 'We offer personal checking, personal savings, money market, certificates of deposit (CD), investment accounts, and business checking.',
  },
  {
    q: 'Are there monthly maintenance fees?',
    a: 'No. There are no monthly maintenance fees on any of our personal accounts. Business accounts over $10,000 average daily balance are also fee-free.',
  },
  {
    q: 'How do I contact support?',
    a: 'Reach us 24/7 via in-app chat, or call 1-800-PINE-BANK (Mon–Fri 8 am–8 pm ET). You can also email support@pinetruistbank.com.',
  },
];

/* ─── Sub-components ────────────────────────────────────────────────── */

function FaqItem({ q, a }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-pine-100 last:border-none">
      <button
        className="w-full flex items-center justify-between py-4 text-left font-semibold text-pine-800 hover:text-pine-600"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <p className="pb-4 text-pine-700 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

function TestimonialCard({ name, role, quote }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-pine-100 flex flex-col gap-4">
      {/* Quote mark */}
      <span className="text-4xl leading-none text-gold-400 font-serif select-none">"</span>
      <p className="text-pine-700 text-sm leading-relaxed flex-1">{quote}</p>
      <div>
        <p className="font-bold text-pine-800 text-sm">{name}</p>
        <p className="text-pine-500 text-xs">{role}</p>
      </div>
    </div>
  );
}

/* ─── Landing page ──────────────────────────────────────────────────── */

export function Landing() {
  const [navScrolled, setNavScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-pine-900 font-sans">
      {/* ── Sticky Nav ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-shadow ${
          navScrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur'
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <BrandLogo variant="light" />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-pine-700">
            <a href="#features" className="hover:text-pine-900">
              Features
            </a>
            <a href="#security" className="hover:text-pine-900">
              Security
            </a>
            <a href="#transfers" className="hover:text-pine-900">
              Transfers
            </a>
            <a href="#faq" className="hover:text-pine-900">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-pine-700 hover:text-pine-900 px-3 py-1.5 rounded-lg hover:bg-pine-50"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-bold bg-pine-700 hover:bg-pine-600 text-white px-4 py-2 rounded-xl shadow"
            >
              Open an Account
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #143524 0%, #225f37 55%, #2a7943 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 70% 40%, #e0b94a, transparent), radial-gradient(ellipse 40% 60% at 20% 70%, #8fc89c, transparent)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <span className="inline-block bg-gold-500/20 text-gold-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Banking, reinvented
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
              Your money,
              <br />
              <span className="text-gold-400">your rules.</span>
            </h1>
            <p className="text-pine-200 text-lg md:text-xl max-w-lg mx-auto md:mx-0 mb-8 leading-relaxed">
              Pine Truist Finance Bank gives you powerful digital banking tools, zero hidden fees,
              and security you can actually trust.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                to="/register"
                className="bg-gold-500 hover:bg-gold-400 text-pine-900 font-bold px-6 py-3 rounded-xl shadow-lg text-base"
              >
                Open an Account — Free
              </Link>
              <Link
                to="/login"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold px-6 py-3 rounded-xl text-base"
              >
                Sign in
              </Link>
            </div>
            <p className="text-pine-300 text-xs mt-4">
              FDIC insured · No monthly fees · Opens in &lt;10 minutes
            </p>
          </div>

          {/* Mock dashboard card */}
          <div className="flex-1 max-w-sm mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-pine-100">
              <div className="flex items-center gap-3 mb-6">
                <BrandMark size={36} />
                <div>
                  <p className="text-xs text-pine-500">Personal Checking</p>
                  <p className="font-bold text-pine-800">•••• 4821</p>
                </div>
              </div>
              <p className="text-pine-500 text-xs mb-1">Available Balance</p>
              <p className="text-4xl font-extrabold text-pine-800 mb-6">$12,840.50</p>
              <div className="flex gap-2 mb-6">
                {['Deposit', 'Transfer', 'Pay'].map((label) => (
                  <button
                    key={label}
                    className="flex-1 text-xs font-semibold bg-pine-50 hover:bg-pine-100 text-pine-700 rounded-xl py-2"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Coffee & More', amount: '-$4.80', date: 'Today' },
                  { label: 'Direct Deposit', amount: '+$3,200.00', date: 'Yesterday' },
                  { label: 'Electric Bill', amount: '-$92.50', date: 'Mon' },
                ].map(({ label, amount, date }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-pine-700">{label}</span>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${amount.startsWith('+') ? 'text-pine-600' : 'text-pine-800'}`}
                      >
                        {amount}
                      </p>
                      <p className="text-pine-400 text-xs">{date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────────────── */}
      <section className="bg-pine-50 border-y border-pine-100 py-4">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap gap-6 items-center justify-center text-pine-600 text-sm font-medium">
          {[
            '🏦 FDIC Insured',
            '🔒 256-bit Encryption',
            '📱 iOS & Android',
            '💬 24/7 Support',
            '⚡ Real-time Alerts',
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-pine-800 mb-3">
              Everything you need in a modern bank
            </h2>
            <p className="text-pine-600 max-w-xl mx-auto">
              Built for how real people use money today — with the safeguards you'd expect from a
              traditional institution.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, body, color }) => (
              <div
                key={title}
                className="bg-white border border-pine-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`mb-4 ${color}`}>
                  <Icon className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-pine-800 mb-2">{title}</h3>
                <p className="text-pine-600 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ───────────────────────────────────────────────── */}
      <section
        id="security"
        className="py-20 px-4"
        style={{ background: 'linear-gradient(135deg, #143524, #225f37)' }}
      >
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-12 items-center">
          {/* Icon grid */}
          <div className="flex-1 grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    i % 3 === 0
                      ? 'rgba(224,185,74,0.15)'
                      : i % 3 === 1
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(255,255,255,0.08)',
                }}
              >
                {i === 4 && <ShieldIcon className="w-10 h-10 text-gold-400" />}
                {i !== 4 && <LockIcon className="w-8 h-8 text-pine-200 opacity-40" />}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <span className="inline-block text-gold-400 text-xs font-bold uppercase tracking-widest mb-3">
              Security
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Your money is protected
              <br />
              at every layer
            </h2>
            <p className="text-pine-200 mb-6 leading-relaxed">
              From the moment you log in to the second a transfer clears, every action is monitored,
              encrypted, and verified.
            </p>
            <ul className="space-y-3">
              {SECURITY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2 text-pine-100 text-sm">
                  <CheckCircleIcon className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="inline-block mt-8 bg-gold-500 hover:bg-gold-400 text-pine-900 font-bold px-5 py-3 rounded-xl shadow"
            >
              Start banking securely
            </Link>
          </div>
        </div>
      </section>

      {/* ── Transfers ──────────────────────────────────────────────── */}
      <section id="transfers" className="py-20 px-4 bg-pine-50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-pine-800 mb-3">
              Fast, transparent transfers
            </h2>
            <p className="text-pine-600 max-w-md mx-auto">
              No surprise fees. No guessing how long it takes. Just clear pricing and predictable
              timing.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-pine-100 overflow-hidden">
            <div className="grid grid-cols-3 bg-pine-800 text-white text-xs font-semibold uppercase tracking-wider px-6 py-3">
              <span>Transfer type</span>
              <span className="text-center">Fee</span>
              <span className="text-right">Time</span>
            </div>
            {TRANSFER_ITEMS.map(({ label, fee, time }, i) => (
              <div
                key={label}
                className={`grid grid-cols-3 px-6 py-4 text-sm border-b border-pine-50 last:border-none ${i % 2 === 0 ? '' : 'bg-pine-50'}`}
              >
                <span className="font-medium text-pine-800">{label}</span>
                <span
                  className={`text-center font-bold ${fee === 'Free' ? 'text-pine-600' : 'text-pine-800'}`}
                >
                  {fee}
                </span>
                <span className="text-right text-pine-600">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-pine-800 mb-3">
              Customers love it
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Support CTA ────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-pine-50 border-y border-pine-100">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-pine-800 mb-3">
            We're here when you need us
          </h2>
          <p className="text-pine-600 mb-6">
            In-app chat, phone support, and email — 24 hours a day, 7 days a week.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:support@pinetruistbank.com"
              className="bg-pine-700 hover:bg-pine-600 text-white font-semibold px-5 py-3 rounded-xl"
            >
              Email support
            </a>
            <a
              href="tel:18007463265"
              className="bg-white hover:bg-pine-50 text-pine-800 border border-pine-200 font-semibold px-5 py-3 rounded-xl"
            >
              1-800-PINE-BANK
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-pine-800 mb-3">
              Frequently asked questions
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-pine-100 shadow-sm px-6">
            {FAQS.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── App badges ─────────────────────────────────────────────── */}
      <section
        className="py-16 px-4"
        style={{ background: 'linear-gradient(135deg, #225f37, #143524)' }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">Bank on the go</h2>
          <p className="text-pine-200 mb-8">
            Download the Pine Truist app for iOS and Android. All the same power, in your pocket.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {[
              { store: 'App Store', sub: 'iPhone & iPad' },
              { store: 'Google Play', sub: 'Android' },
            ].map(({ store, sub }) => (
              <div
                key={store}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl px-5 py-3 cursor-not-allowed select-none"
                title="Coming soon"
              >
                <MobileIcon className="w-8 h-8 text-gold-400" />
                <div className="text-left">
                  <p className="text-white/60 text-xs">Download on the</p>
                  <p className="text-white font-bold text-sm">{store}</p>
                  <p className="text-white/60 text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-pine-300 text-xs mt-4">Mobile apps coming soon</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-pine-900 text-pine-300 py-12 px-4">
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo variant="dark" className="mb-3" />
            <p className="text-pine-400 text-xs leading-relaxed max-w-xs">
              Pine Truist Finance Bank is a federally chartered bank. Member FDIC. Equal Housing
              Lender.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white text-sm mb-3">Products</p>
            <ul className="space-y-2 text-xs">
              {['Checking', 'Savings', 'Money Market', 'CDs', 'Business'].map((p) => (
                <li key={p}>
                  <Link to="/register" className="hover:text-white">
                    {p}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white text-sm mb-3">Company</p>
            <ul className="space-y-2 text-xs">
              {['About', 'Careers', 'Press', 'Security', 'Blog'].map((p) => (
                <li key={p}>
                  <a href="#" className="hover:text-white">
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white text-sm mb-3">Legal</p>
            <ul className="space-y-2 text-xs">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Disclosures'].map((p) => (
                <li key={p}>
                  <a href="#" className="hover:text-white">
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-pine-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-pine-500">
            © {new Date().getFullYear()} Pine Truist Finance Bank. All rights reserved.
          </p>
          <p className="text-xs text-pine-500">
            Deposits are FDIC insured up to $250,000 per depositor.
          </p>
        </div>
      </footer>
    </div>
  );
}
