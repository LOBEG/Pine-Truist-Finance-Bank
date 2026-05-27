import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand.jsx';

const serviceCards = [
  {
    title: 'Everyday accounts',
    desc: 'Open checking and savings designed for quick visibility, clear activity, and secure access from anywhere.',
    metric: '24/7',
  },
  {
    title: 'Protected movement',
    desc: 'Send internal transfers, ACH, and wires with layered verification and continuous risk monitoring.',
    metric: 'MFA',
  },
  {
    title: 'Human support',
    desc: 'Get help with onboarding, account questions, and service needs from a team focused on trust.',
    metric: 'Care',
  },
];

const securityHighlights = [
  'Multi-factor authentication safeguards account access.',
  'Encrypted data handling protects sensitive personal information.',
  'Real-time fraud signals help flag suspicious activity quickly.',
];

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -left-8 top-12 h-28 w-28 rounded-full bg-gold-400/30 blur-3xl" />
      <div className="absolute -right-10 bottom-10 h-36 w-36 rounded-full bg-pine-400/30 blur-3xl" />
      <div className="relative rounded-[2.5rem] border border-white/20 bg-white/10 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="rounded-[2rem] bg-slate-950/80 p-5 ring-1 ring-white/10">
          <div className="mb-6 flex items-center justify-between text-sm text-slate-300">
            <span>Pine dashboard</span>
            <span className="rounded-full bg-pine-400/20 px-3 py-1 text-pine-100">Secure</span>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-pine-500 to-pine-800 p-5 text-white shadow-xl">
            <p className="text-sm text-pine-100">Available balance</p>
            <div className="mt-4 h-8 w-36 rounded-full bg-white/30" />
            <div className="mt-5 flex gap-2">
              <span className="h-2 w-16 rounded-full bg-white/40" />
              <span className="h-2 w-10 rounded-full bg-white/25" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {['Transfer', 'Deposit'].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-white/10 p-4 text-center text-sm font-bold text-white"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {['Card purchase', 'Savings move', 'Wire review'].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                <span
                  className={`h-9 w-9 rounded-full ${index === 1 ? 'bg-gold-400/80' : 'bg-pine-400/80'}`}
                />
                <div className="flex-1">
                  <div className="h-2.5 w-28 rounded-full bg-white/25" />
                  <div className="mt-2 h-2 w-16 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-pine-900">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <BrandLogo variant="dark" />
          <nav className="hidden items-center gap-7 text-sm font-bold text-white/80 md:flex">
            <a href="#services" className="transition hover:text-white">
              Services
            </a>
            <a href="#security" className="transition hover:text-white">
              Security
            </a>
            <a href="#support" className="transition hover:text-white">
              Support
            </a>
            <Link to="/login" className="transition hover:text-white">
              Login
            </Link>
          </nav>
          <Link to="/register" className="btn-primary hidden px-5 py-2.5 sm:inline-flex">
            Open account
          </Link>
        </div>
      </header>

      <main>
        <section className="relative bg-[radial-gradient(circle_at_15%_10%,_rgba(224,185,74,0.20),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(98,175,116,0.34),_transparent_30%),linear-gradient(135deg,_#06111d_0%,_#10243c_48%,_#123524_100%)] text-white">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f7fbf8] to-transparent" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-28">
            <div>
              <span className="eyebrow">Modern digital banking</span>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Banking redesigned around clarity, security, and control.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                Pine Truist Finance Bank brings everyday money management into a polished, protected
                workspace—built for quick onboarding, confident transfers, and always-on account
                access.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="btn-primary px-8">
                  Start your application
                </Link>
                <Link to="/login" className="btn-ghost px-8">
                  Secure login
                </Link>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-center">
                {['FDIC insured', 'Bank-grade controls', 'Real-time alerts'].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-white/90 backdrop-blur"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section id="services" className="bg-[#f7fbf8] px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-pine-600">
                  Services
                </p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black text-pine-900 md:text-4xl">
                  A premium banking experience without the clutter.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-600">
                The redesigned experience emphasizes clean account actions, readable content, and
                trustworthy visual cues.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {serviceCards.map((card) => (
                <article
                  key={card.title}
                  className="card group transition duration-200 hover:-translate-y-1"
                >
                  <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-pine-900 text-xl font-black text-gold-400 shadow-lg shadow-pine-900/20">
                    {card.metric}
                  </div>
                  <h3 className="text-xl font-black text-pine-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="bg-white px-4 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] bg-pine-900 p-6 text-white shadow-2xl shadow-pine-900/20 md:grid-cols-[0.95fr_1.05fr] md:p-10">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-gold-400">
                Security
              </p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">Confidence at every step.</h2>
              <p className="mt-4 leading-7 text-pine-100">
                From application through login and transfers, Pine Truist presents protection in a
                clearer, calmer interface.
              </p>
            </div>
            <div className="grid gap-3">
              {securityHighlights.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 text-sm text-pine-50"
                >
                  <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-pine-400/20 text-pine-100">
                    <CheckIcon />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="support" className="bg-[#f7fbf8] px-4 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-pine-600">
              Ready when you are
            </p>
            <h2 className="mt-3 text-3xl font-black text-pine-900 md:text-4xl">
              Open an account or return to your dashboard.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
              A refined landing, login, and registration flow now guides customers with stronger
              hierarchy, softer surfaces, and clearer calls to action.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary px-8">
                Open an account
              </Link>
              <Link to="/login" className="btn-secondary px-8">
                Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 px-4 py-10 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <BrandLogo variant="dark" />
          <div className="flex flex-wrap gap-5">
            <a href="#security" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#support" className="hover:text-white">
              Terms &amp; Conditions
            </a>
            <a href="#support" className="hover:text-white">
              Contact
            </a>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl text-xs text-slate-500">
          © {new Date().getFullYear()} Pine Truist Finance Bank. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
