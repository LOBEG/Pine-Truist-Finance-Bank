import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand.jsx';

/* ─── Inline SVG icons ──────────────────────────────────────────────── */

function EasyTransfersIcon({ className = 'w-12 h-12' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#1b3a5c" />
      <path
        d="M14 20h14m0 0l-4-4m4 4l-4 4M34 28H20m0 0l4 4m-4-4l4-4"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SecureBankingIcon({ className = 'w-12 h-12' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#1b3a5c" />
      <path
        d="M24 12l-10 5v7c0 6.5 4.2 12.6 10 14 5.8-1.4 10-7.5 10-14v-7l-10-5z"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="M20 24l3 3 5-6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportIcon({ className = 'w-12 h-12' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#1b3a5c" />
      <path d="M16 28v-4a8 8 0 1116 0v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="12" y="26" width="4" height="8" rx="2" fill="white" />
      <rect x="32" y="26" width="4" height="8" rx="2" fill="white" />
      <path d="M32 34c0 3-3 4-6 4h-2" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GreenCheckIcon({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#22c55e" />
      <path
        d="M8 12l3 3 5-6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const serviceCards = [
  {
    title: 'Digital Checking',
    desc: 'Open and manage secure everyday banking with instant balances, transfers, deposits, and alerts.',
  },
  {
    title: 'Savings Growth',
    desc: 'Build reserves with goal-based savings tools and clear visibility into your progress.',
  },
  {
    title: 'Business Banking',
    desc: 'Bank-ready accounts for payments, wires, vendor transfers, and operational cash flow.',
  },
];

const helpCards = [
  'Account specialists are available 24/7 for login, transfer, and security support.',
  'Real-time fraud monitoring helps protect every session and transaction.',
  'Encrypted onboarding keeps personal information protected from application to approval.',
];

/* ─── Landing page ──────────────────────────────────────────────────── */

export function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-pine-900 font-sans">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-slate-950/95 text-white border-b border-white/10 sticky top-0 z-10 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <BrandLogo variant="dark" />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#home" className="hover:text-pine-200">
              Home
            </a>
            <a href="#about" className="hover:text-pine-200">
              About
            </a>
            <a href="#services" className="hover:text-pine-200">
              Services
            </a>
            <a href="#help" className="hover:text-pine-200">
              Help
            </a>
            <Link to="/login" className="hover:text-pine-200">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section
        id="home"
        className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(58,143,92,0.35),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#10243c_48%,_#123524_100%)]"
      >
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-10 relative">
          <div className="flex-1 text-center md:text-left">
            <p className="inline-flex rounded-full border border-gold-400/40 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-5">
              Trusted digital banking
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              Secure Banking
              <br />
              <span className="font-normal">for Your Modern Life</span>
            </h1>
            <p className="text-slate-200 text-lg mb-8 max-w-xl">
              Open accounts, monitor balances, and move money with bank-grade controls built for
              everyday customers and growing businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                to="/register"
                className="inline-block bg-pine-500 hover:bg-pine-400 text-white font-bold px-8 py-3 rounded-lg shadow-lg text-base"
              >
                Open an Account
              </Link>
              <Link
                to="/login"
                className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-3 rounded-lg ring-1 ring-white/25 text-base"
              >
                Secure Login
              </Link>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <svg
              viewBox="0 0 320 280"
              className="w-full max-w-sm drop-shadow-2xl"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2a5a8c" />
                  <stop offset="100%" stopColor="#1b3a5c" />
                </linearGradient>
              </defs>
              <rect x="60" y="20" width="200" height="240" rx="20" fill="url(#heroGrad)" />
              <rect x="80" y="60" width="160" height="30" rx="6" fill="#3a8f5c" opacity="0.8" />
              <text x="160" y="80" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                $12,840.50
              </text>
              <rect x="80" y="105" width="70" height="25" rx="5" fill="rgba(255,255,255,0.15)" />
              <text x="115" y="122" textAnchor="middle" fill="white" fontSize="9">
                Deposit
              </text>
              <rect x="160" y="105" width="80" height="25" rx="5" fill="rgba(255,255,255,0.15)" />
              <text x="200" y="122" textAnchor="middle" fill="white" fontSize="9">
                Transfer
              </text>
              <rect x="80" y="145" width="160" height="1" fill="rgba(255,255,255,0.2)" />
              <circle cx="95" cy="170" r="8" fill="#3a8f5c" />
              <rect x="112" y="165" width="80" height="10" rx="3" fill="rgba(255,255,255,0.2)" />
              <circle cx="95" cy="200" r="8" fill="#e0b94a" />
              <rect x="112" y="195" width="100" height="10" rx="3" fill="rgba(255,255,255,0.2)" />
              <circle cx="95" cy="230" r="8" fill="#3a8f5c" />
              <rect x="112" y="225" width="60" height="10" rx="3" fill="rgba(255,255,255,0.2)" />
              <circle cx="270" cy="30" r="40" fill="rgba(58,143,92,0.2)" />
              <circle cx="50" cy="250" r="25" fill="rgba(224,185,74,0.15)" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────────────── */}
      <section id="services" className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pine-600">Services</p>
            <h2 className="text-3xl font-extrabold text-pine-900 mt-2">
              Banking that feels secure
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {serviceCards.map((card, index) => {
              const Icon =
                index === 0 ? EasyTransfersIcon : index === 1 ? SecureBankingIcon : SupportIcon;
              return (
                <div
                  key={card.title}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-pine-100 bg-white p-6 shadow-sm"
                >
                  <Icon className="w-14 h-14" />
                  <h3 className="font-bold text-pine-800 text-lg">{card.title}</h3>
                  <p className="text-sm text-slate-600">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us Section ──────────────────────────────────── */}
      <section id="about" className="py-16 px-4 bg-slate-50">
        <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pine-600">About</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pine-800 mt-2 mb-4">
              Pine Truist Finance Bank is built around trust.
            </h2>
            <p className="text-slate-600">
              We combine modern account opening with rigorous identity, audit, and transaction
              controls so customers can bank confidently from any device.
            </p>
          </div>
          <div className="space-y-5 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">
                Low Fees &amp; High Interest
              </span>
            </div>
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">Fast &amp; Reliable</span>
            </div>
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">Trusted &amp; Secure</span>
            </div>
          </div>
        </div>
      </section>

      <section id="help" className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pine-600">Help</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pine-900 mt-2">
              Support for every banking moment
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {helpCards.map((help) => (
              <div key={help} className="rounded-2xl bg-pine-50 p-5 text-sm text-pine-800">
                {help}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-gray-300 py-8 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
          <a href="#about" className="hover:text-white">
            About Us
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#privacy" className="hover:text-white">
            Privacy Policy
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#terms" className="hover:text-white">
            Terms &amp; Conditions
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#contact" className="hover:text-white">
            Contact
          </a>
        </div>
        <div className="mx-auto max-w-5xl mt-8 grid md:grid-cols-3 gap-4 text-sm">
          <div id="privacy" className="rounded-xl bg-white/5 p-4">
            <h3 className="font-bold text-white mb-2">Privacy Policy</h3>
            <p>
              Customer data is protected with encryption, strict access controls, and audit logs.
            </p>
          </div>
          <div id="terms" className="rounded-xl bg-white/5 p-4">
            <h3 className="font-bold text-white mb-2">Terms &amp; Conditions</h3>
            <p>Accounts are subject to verification, fraud review, and applicable banking rules.</p>
          </div>
          <div id="contact" className="rounded-xl bg-white/5 p-4">
            <h3 className="font-bold text-white mb-2">Contact</h3>
            <p>
              Reach Pine Truist support any time for account access, onboarding, or service help.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">
          © {new Date().getFullYear()} Pine Truist Finance Bank. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
