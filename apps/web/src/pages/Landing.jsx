import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand.jsx';

const products = [
  {
    name: 'Pine Checking',
    rate: 'No monthly fee',
    desc: 'Everyday checking with same-day transfers, mobile deposit, and free ATM access at over 40,000 locations nationwide.',
    bullets: ['No minimum balance', 'Free debit card', 'Real-time alerts'],
    cta: 'Open checking',
  },
  {
    name: 'Pine High-Yield Savings',
    rate: '4.40% APY',
    desc: 'Earn competitive interest on every dollar with no monthly maintenance fees and unlimited transfers between Pine accounts.',
    bullets: ['No minimum to open', 'FDIC insured to $250,000', 'Compounded daily'],
    cta: 'Start saving',
  },
  {
    name: 'Pine Business',
    rate: 'For owners',
    desc: 'Full-featured business banking with ACH, wires, and multi-user permissions designed for growing companies.',
    bullets: ['Multi-user access', 'Domestic & international wires', 'Dedicated support'],
    cta: 'Open business account',
  },
];

const valueProps = [
  {
    title: 'Built for security',
    body: 'Multi-factor authentication, device verification, and continuous fraud monitoring protect every session and every transaction.',
  },
  {
    title: 'Move money your way',
    body: 'Send internal transfers in seconds, schedule ACH, or send domestic and international wires — all from one dashboard.',
  },
  {
    title: 'Clear, honest banking',
    body: 'No surprise overdraft fees, no minimum balance penalties, and statements you can actually read.',
  },
  {
    title: 'Service that responds',
    body: 'Reach a real specialist through secure messaging or phone seven days a week for account, fraud, and onboarding help.',
  },
];

const testimonials = [
  {
    quote:
      'Switching to Pine Truist took an afternoon. Direct deposit landed two days early, and the transfer experience is the cleanest I have used.',
    name: 'Adaeze O.',
    role: 'Account holder since 2024',
  },
  {
    quote:
      'I run a small consultancy and Pine Business handles payroll, vendor ACH, and wire transfers without the bloat my old bank charged for.',
    name: 'Marcus W.',
    role: 'Founder, Northwind Studio',
  },
  {
    quote:
      'The fraud alerts are immediate and the in-app review made it a one-tap confirmation. That alone is worth moving for.',
    name: 'Priya S.',
    role: 'Pine Checking customer',
  },
];

const faqs = [
  {
    q: 'Is Pine Truist Finance Bank FDIC insured?',
    a: 'Yes. Deposits at Pine Truist Finance Bank are insured by the FDIC up to $250,000 per depositor, per ownership category.',
  },
  {
    q: 'How long does it take to open an account?',
    a: 'Most applications complete in under ten minutes. After identity verification, your account is funded and usable the same day.',
  },
  {
    q: 'What do I need to apply?',
    a: 'A valid government-issued ID, your Social Security number, a U.S. mailing address, and an email and phone number for verification.',
  },
  {
    q: 'Are there monthly maintenance fees?',
    a: 'No. Pine Checking and Pine Savings have no monthly maintenance fee and no minimum balance requirement.',
  },
  {
    q: 'How does Pine Truist protect my account?',
    a: 'Every account is protected by multi-factor authentication, encrypted data storage, session monitoring, and continuous fraud detection backed by a 24/7 security team.',
  },
];

const trustBadges = [
  'FDIC insured to $250,000',
  'Equal Housing Lender',
  '256-bit encryption',
  'SOC 2 monitored',
];

function ShieldCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l8 3v6c0 5-3.6 8.4-8 9-4.4-.6-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="ml-1 h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-slate-200 py-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-6 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-slate-900 sm:text-lg">{q}</span>
        <span
          className={`mt-1 grid h-7 w-7 flex-none place-items-center rounded-full border border-slate-300 text-slate-600 transition ${
            open ? 'rotate-45 border-pine-700 text-pine-700' : ''
          }`}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      {open && <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">{a}</p>}
    </div>
  );
}

export function Landing() {
  const [openFaq, setOpenFaq] = useState(0);
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="container-pine flex items-center justify-between py-4">
          <BrandLogo variant="light" />
          <nav
            className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex"
            aria-label="Primary"
          >
            <a href="#personal" className="hover:text-pine-800">
              Personal
            </a>
            <a href="#business" className="hover:text-pine-800">
              Business
            </a>
            <a href="#security" className="hover:text-pine-800">
              Security
            </a>
            <a href="#support" className="hover:text-pine-800">
              Support
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link to="/register" className="btn-primary px-5 py-2.5 text-sm">
              Open an account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-pine-900 text-white">
        <div className="container-pine grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-gold-400">
              <ShieldCheck /> FDIC insured · Member FDIC
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Banking with the
              <br className="hidden sm:inline" /> care it deserves.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-pine-100">
              Open a checking or savings account in minutes. Move money with confidence. Manage
              everything in a clean, secure dashboard backed by a team that answers when you call.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary bg-white text-pine-900 hover:bg-pine-50">
                Open an account <ArrowRight />
              </Link>
              <Link
                to="/login"
                className="btn inline-flex border border-white/30 text-white hover:bg-white/10"
              >
                Sign in to your account
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8 text-left">
              <div>
                <dt className="text-xs uppercase tracking-wider text-pine-200">Savings APY</dt>
                <dd className="mt-1 text-2xl font-bold text-white">4.40%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-pine-200">Monthly fee</dt>
                <dd className="mt-1 text-2xl font-bold text-white">$0</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-pine-200">ATM network</dt>
                <dd className="mt-1 text-2xl font-bold text-white">40k+</dd>
              </div>
            </dl>
          </div>
          {/* Realistic dashboard card */}
          <div className="relative">
            <div className="absolute -left-10 top-10 hidden h-40 w-40 rounded-full bg-gold-400/20 blur-3xl md:block" />
            <div className="relative rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total balance</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">$24,318.74</p>
                </div>
                <span className="rounded-full bg-pine-50 px-3 py-1 text-xs font-semibold text-pine-700">
                  All accounts
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-slate-500">Pine Checking ••4218</p>
                  <p className="mt-1 text-lg font-semibold">$5,842.12</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-slate-500">Pine Savings ••9034</p>
                  <p className="mt-1 text-lg font-semibold">$18,476.62</p>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recent activity
                </p>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {[
                    { name: 'Direct deposit · Acme Payroll', amt: '+$3,210.00', neg: false },
                    { name: 'Transfer to Savings', amt: '−$500.00', neg: true },
                    { name: 'Whole Foods Market', amt: '−$84.32', neg: true },
                    { name: 'Refund · Delta Air Lines', amt: '+$129.40', neg: false },
                  ].map((t) => (
                    <li key={t.name} className="flex items-center justify-between py-2.5">
                      <span className="text-slate-700">{t.name}</span>
                      <span
                        className={`font-semibold ${t.neg ? 'text-slate-900' : 'text-pine-700'}`}
                      >
                        {t.amt}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-pine-50 px-3 py-2 text-xs text-pine-800">
                <ShieldCheck /> Encrypted session · Verified on this device
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="container-pine flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-sm font-semibold text-slate-600">
          {trustBadges.map((b) => (
            <span key={b} className="inline-flex items-center gap-2">
              <ShieldCheck /> {b}
            </span>
          ))}
        </div>
      </section>

      {/* Products */}
      <section id="personal" className="container-pine py-20 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="eyebrow">Accounts &amp; products</span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
              Designed for the way you actually bank
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-7 text-slate-600">
            Choose the account that fits your life today. Add another in minutes when you need it —
            everything lives under one secure sign-in.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3" id="business">
          {products.map((p) => (
            <article
              key={p.name}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-pine-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-pine-700">{p.rate}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">{p.desc}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1 grid h-4 w-4 flex-none place-items-center rounded-full bg-pine-100 text-[10px] font-bold text-pine-800">
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-7 inline-flex items-center font-semibold text-pine-700 hover:text-pine-900"
              >
                {p.cta} <ArrowRight />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section id="security" className="bg-slate-50 py-20 md:py-24">
        <div className="container-pine">
          <div className="max-w-2xl">
            <span className="eyebrow">Why Pine Truist</span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
              Modern banking, careful where it counts
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              Every feature is built on the same security foundation, so the experience stays simple
              while your accounts stay protected.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {valueProps.map((v, i) => (
              <div key={v.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-pine-700 text-sm font-bold text-white">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-pine py-20 md:py-24">
        <div className="max-w-2xl">
          <span className="eyebrow">What customers say</span>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Real accounts, real switching stories
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="text-gold-500" aria-hidden="true">
                ★★★★★
              </div>
              <blockquote className="mt-4 text-[15px] leading-7 text-slate-700">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-slate-100 pt-4 text-sm">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-slate-500">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="support" className="bg-slate-50 py-20 md:py-24">
        <div className="container-pine grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
              Questions answered before you ask
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              Still need help? Our customer care team is reachable by secure message or phone every
              day of the week.
            </p>
            <Link to="/register" className="btn-primary mt-6">
              Open my account
            </Link>
          </div>
          <div>
            {faqs.map((f, i) => (
              <FaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-pine-900 py-16 text-white">
        <div className="container-pine flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to switch your everyday bank?</h2>
            <p className="mt-2 text-pine-100">
              Open an account online in about ten minutes. No paperwork, no branch visit required.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary bg-white text-pine-900 hover:bg-pine-50">
              Open an account
            </Link>
            <Link to="/login" className="btn border border-white/30 text-white hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="container-pine grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo variant="dark" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Pine Truist Finance Bank, Member FDIC. Banking products are provided by Pine Truist
              Finance Bank, N.A.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Banking</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#personal" className="hover:text-white">
                  Checking
                </a>
              </li>
              <li>
                <a href="#personal" className="hover:text-white">
                  Savings
                </a>
              </li>
              <li>
                <a href="#business" className="hover:text-white">
                  Business
                </a>
              </li>
              <li>
                <Link to="/register" className="hover:text-white">
                  Open an account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#security" className="hover:text-white">
                  Security
                </a>
              </li>
              <li>
                <a href="#support" className="hover:text-white">
                  Support
                </a>
              </li>
              <li>
                <a href="#support" className="hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#legal" className="hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#legal" className="hover:text-white">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#legal" className="hover:text-white">
                  Electronic Consent
                </a>
              </li>
              <li>
                <a href="#legal" className="hover:text-white">
                  Accessibility
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="container-pine flex flex-col items-start justify-between gap-3 py-6 text-xs text-slate-500 sm:flex-row sm:items-center">
            <p>
              © {year} Pine Truist Finance Bank, N.A. All rights reserved. Member FDIC. Equal
              Housing Lender.
            </p>
            <p>Deposits are insured by the FDIC up to $250,000 per depositor.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
