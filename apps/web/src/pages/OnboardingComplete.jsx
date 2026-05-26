import { Link } from 'react-router-dom';

export function OnboardingComplete() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="card text-center space-y-6">
        <div>
          <span className="text-5xl">🎉</span>
          <h1 className="text-2xl font-bold text-pine-900 mt-4">Welcome to Pine Truist!</h1>
          <p className="text-pine-700 mt-2">
            Your account is open. Here are your next steps to get the most from your banking
            experience.
          </p>
        </div>

        <div className="text-left space-y-3">
          <div className="flex items-start gap-3 p-3 bg-pine-50 rounded-xl ring-1 ring-pine-100">
            <span className="text-xl mt-0.5">🔐</span>
            <div>
              <p className="font-semibold text-pine-900 text-sm">
                Enable two-factor authentication
              </p>
              <p className="text-xs text-pine-700 mt-0.5">
                Protect your account with an authenticator app.
              </p>
              <Link
                to="/settings/security"
                className="text-xs text-pine-800 font-semibold mt-1 inline-block hover:underline"
              >
                Set up MFA →
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-pine-50 rounded-xl ring-1 ring-pine-100">
            <span className="text-xl mt-0.5">💳</span>
            <div>
              <p className="font-semibold text-pine-900 text-sm">Explore your accounts</p>
              <p className="text-xs text-pine-700 mt-0.5">
                View balances, make transfers, set up direct deposit.
              </p>
              <Link
                to="/"
                className="text-xs text-pine-800 font-semibold mt-1 inline-block hover:underline"
              >
                Go to Dashboard →
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-pine-50 rounded-xl ring-1 ring-pine-100">
            <span className="text-xl mt-0.5">📱</span>
            <div>
              <p className="font-semibold text-pine-900 text-sm">Download the mobile app</p>
              <p className="text-xs text-pine-700 mt-0.5">
                Bank anywhere, anytime with biometric login.
              </p>
              <a
                href="#"
                className="text-xs text-pine-800 font-semibold mt-1 inline-block hover:underline"
              >
                Coming soon
              </a>
            </div>
          </div>
        </div>

        <Link to="/" className="btn-primary w-full inline-block text-center py-3">
          Go to my Dashboard
        </Link>

        <p className="text-xs text-pine-600">
          Member FDIC · Equal Housing Lender · Your deposits are insured up to $250,000
        </p>
      </div>
    </div>
  );
}
