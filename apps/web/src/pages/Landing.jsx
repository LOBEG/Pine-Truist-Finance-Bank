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

/* ─── Landing page ──────────────────────────────────────────────────── */

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-pine-900 font-sans">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-[#1b2e4a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <BrandLogo variant="dark" />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#" className="hover:text-pine-200">
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
      <section className="bg-[#1b2e4a] relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              Smart Banking
              <br />
              <span className="font-normal">for Your Modern Life</span>
            </h1>
            <p className="text-gray-300 text-lg mb-8">Manage your money with ease and security.</p>
            <Link
              to="/register"
              className="inline-block bg-[#3a8f5c] hover:bg-[#2f7a4d] text-white font-bold px-8 py-3 rounded-lg shadow-lg text-base"
            >
              Get Started
            </Link>
          </div>
          <div className="flex-1 flex justify-center">
            <svg
              viewBox="0 0 320 280"
              className="w-full max-w-xs"
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
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <EasyTransfersIcon className="w-14 h-14" />
              <h3 className="font-bold text-pine-800 text-lg">Easy Transfers</h3>
            </div>
            <div className="flex flex-col items-center gap-3 md:border-x md:border-gray-200 md:px-6">
              <SecureBankingIcon className="w-14 h-14" />
              <h3 className="font-bold text-pine-800 text-lg">Secure Banking</h3>
            </div>
            <div className="flex flex-col items-center gap-3">
              <SupportIcon className="w-14 h-14" />
              <h3 className="font-bold text-pine-800 text-lg">24/7 Support</h3>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us Section ──────────────────────────────────── */}
      <section id="about" className="py-16 px-4 bg-gray-50">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-pine-800 mb-8">Why Choose Us?</h2>
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

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer id="help" className="bg-[#1b2e4a] text-gray-300 py-8 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
          <a href="#" className="hover:text-white">
            About Us
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#" className="hover:text-white">
            Privacy Policy
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#" className="hover:text-white">
            Terms &amp; Conditions
          </a>
          <span className="hidden sm:inline text-gray-500">·</span>
          <a href="#" className="hover:text-white">
            Contact
          </a>
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">
          © {new Date().getFullYear()} Pine Truist Finance Bank. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
