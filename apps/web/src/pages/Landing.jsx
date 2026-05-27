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
    desc: 'Experience modern checking with instant access to your funds, real-time transaction tracking, and seamless money movement between accounts.',
  },
  {
    title: 'Savings & Growth',
    desc: 'Build your financial future with competitive interest rates, automated savings tools, and transparent account management.',
  },
  {
    title: 'Transfer Solutions',
    desc: 'Move money securely with internal transfers, ACH payments, and wire transfer capabilities—all protected by bank-grade security.',
  },
];

const helpCards = [
  'Multi-factor authentication and encryption protect your login credentials and personal information at every step.',
  'Real-time fraud detection monitors transactions around the clock to identify and prevent suspicious activity.',
  'Secure account recovery options ensure you always have access to your funds when you need them.',
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
              Experience banking built on trust, security, and transparency. Manage your finances
              with confidence through our secure digital platform—accessible anytime, anywhere.
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
            <div className="relative w-full max-w-sm">
              {/* Banking illustration without hardcoded values */}
              <svg
                viewBox="0 0 320 320"
                className="w-full drop-shadow-2xl"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2a5a8c" />
                    <stop offset="100%" stopColor="#1b3a5c" />
                  </linearGradient>
                  <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3a8f5c" />
                    <stop offset="100%" stopColor="#2f7a4d" />
                  </linearGradient>
                </defs>

                {/* Main card device */}
                <rect x="40" y="30" width="240" height="260" rx="24" fill="url(#heroGrad)" />
                <rect
                  x="40"
                  y="30"
                  width="240"
                  height="260"
                  rx="24"
                  fill="rgba(255,255,255,0.02)"
                />

                {/* Account balance area - no specific numbers */}
                <rect
                  x="60"
                  y="65"
                  width="200"
                  height="45"
                  rx="8"
                  fill="url(#cardGrad)"
                  opacity="0.9"
                />
                <rect x="75" y="80" width="90" height="8" rx="4" fill="rgba(255,255,255,0.3)" />
                <rect x="75" y="92" width="50" height="6" rx="3" fill="rgba(255,255,255,0.2)" />

                {/* Action buttons */}
                <rect x="60" y="125" width="90" height="32" rx="6" fill="rgba(255,255,255,0.12)" />
                <rect x="75" y="136" width="60" height="10" rx="2" fill="rgba(255,255,255,0.25)" />

                <rect x="165" y="125" width="95" height="32" rx="6" fill="rgba(255,255,255,0.12)" />
                <rect x="180" y="136" width="65" height="10" rx="2" fill="rgba(255,255,255,0.25)" />

                {/* Transaction list simulation */}
                <line
                  x1="60"
                  y1="175"
                  x2="260"
                  y2="175"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />

                {/* Recent transactions - abstract representation */}
                <circle cx="80" cy="200" r="12" fill="#3a8f5c" opacity="0.8" />
                <rect x="105" y="195" width="100" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
                <rect x="105" y="205" width="65" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

                <circle cx="80" cy="235" r="12" fill="#e0b94a" opacity="0.8" />
                <rect x="105" y="230" width="85" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
                <rect x="105" y="240" width="70" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

                <circle cx="80" cy="270" r="12" fill="#3a8f5c" opacity="0.8" />
                <rect x="105" y="265" width="95" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
                <rect x="105" y="275" width="50" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

                {/* Decorative elements */}
                <circle cx="280" cy="50" r="45" fill="rgba(58,143,92,0.15)" />
                <circle cx="35" cy="280" r="30" fill="rgba(224,185,74,0.12)" />
              </svg>
            </div>
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
              Banking you can trust
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Pine Truist Finance Bank combines cutting-edge technology with rigorous security
              standards. Every account is protected by multi-layered authentication, real-time fraud
              monitoring, and encrypted data storage. We&apos;re committed to providing transparent,
              accessible banking services that put your financial security first.
            </p>
          </div>
          <div className="space-y-5 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">FDIC Insured Accounts</span>
            </div>
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">Bank-Grade Security</span>
            </div>
            <div className="flex items-center gap-3">
              <GreenCheckIcon className="w-7 h-7 flex-shrink-0" />
              <span className="text-pine-800 text-lg font-medium">24/7 Account Access</span>
            </div>
          </div>
        </div>
      </section>

      <section id="help" className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-pine-600">Help</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pine-900 mt-2">
              Your security is our priority
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
