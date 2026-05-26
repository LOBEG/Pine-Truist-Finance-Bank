import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';

// Lazy load internal modules for additional code splitting
const UsersPage = lazy(() => import('./pages/Users'));
const WithdrawalsPage = lazy(() => import('./pages/Withdrawals'));
const TransactionsPage = lazy(() => import('./pages/Transactions'));
const CompliancePage = lazy(() => import('./pages/Compliance'));
const AuditPage = lazy(() => import('./pages/Audit'));
const FraudQueuePage = lazy(() => import('./pages/FraudQueue'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const OverviewPage = lazy(() => import('./pages/Overview'));

// Internal navigation items with role requirements
const NAV_ITEMS = [
  { path: '', label: 'Overview', icon: '📊', roles: ['admin', 'super_admin', 'compliance_officer', 'auditor', 'support'] },
  { path: 'users', label: 'Users', icon: '👥', roles: ['admin', 'super_admin', 'support'] },
  { path: 'transactions', label: 'Transactions', icon: '💳', roles: ['admin', 'super_admin', 'compliance_officer', 'auditor'] },
  { path: 'withdrawals', label: 'Withdrawals', icon: '💸', roles: ['admin', 'super_admin', 'compliance_officer'] },
  { path: 'fraud-queue', label: 'Fraud Queue', icon: '🚨', roles: ['admin', 'super_admin', 'compliance_officer'] },
  { path: 'compliance', label: 'Compliance', icon: '📋', roles: ['admin', 'super_admin', 'compliance_officer'] },
  { path: 'audit', label: 'Audit Log', icon: '📜', roles: ['admin', 'super_admin', 'auditor'] },
  { path: 'settings', label: 'Settings', icon: '⚙️', roles: ['super_admin'] },
];

// Loading spinner for lazy-loaded components
function InternalLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      <span className="ml-3 text-gray-600">Loading module...</span>
    </div>
  );
}

// Internal header with security indicators
function InternalHeader({ user, onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🏦</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Pine Truist Finance Bank</h1>
              <p className="text-xs text-slate-400">Internal Operations Console</p>
            </div>
          </div>
          <div className="hidden md:flex items-center px-3 py-1 bg-red-900/30 border border-red-700 rounded text-xs">
            <span className="animate-pulse mr-2 h-2 w-2 rounded-full bg-red-500"></span>
            RESTRICTED ACCESS
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:block text-sm text-slate-400">
            {currentTime.toLocaleString()}
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name || 'Operator'}</p>
              <p className="text-xs text-slate-400 uppercase">{user?.role || 'Unknown'}</p>
            </div>
            
            <div className="flex items-center space-x-2">
              {user?.mfaVerified && (
                <span title="MFA Verified" className="text-green-400">🔐</span>
              )}
              <button
                onClick={onLogout}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// Internal sidebar navigation
function InternalSidebar({ userRole, basePath }) {
  const location = useLocation();
  
  const hasAccess = (roles) => roles.includes(userRole);
  
  const isActive = (path) => {
    const fullPath = `${basePath}/${path}`.replace(/\/$/, '');
    return location.pathname === fullPath || 
           (path === '' && location.pathname === basePath);
  };

  return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen">
      <nav className="p-4">
        <div className="mb-6">
          <p className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-2">Navigation</p>
        </div>
        
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            if (!hasAccess(item.roles)) return null;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path || '.'}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-3">Quick Actions</p>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 bg-amber-700/50 hover:bg-amber-700 rounded text-sm text-left transition-colors">
              🔍 Search Customer
            </button>
            <button className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-left transition-colors">
              📞 Support Queue
            </button>
          </div>
        </div>

        <div className="mt-8 p-3 bg-slate-900/50 rounded-lg">
          <p className="text-xs text-slate-500 mb-2">Session Security</p>
          <div className="flex items-center text-xs text-green-400">
            <span className="mr-2">✓</span>
            <span>Encrypted Connection</span>
          </div>
          <div className="flex items-center text-xs text-green-400 mt-1">
            <span className="mr-2">✓</span>
            <span>MFA Active</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}

// Main Operations Console layout
export default function OpsConsole() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const basePath = import.meta.env.VITE_INTERNAL_BASE_PATH || '/ops';
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    // Verify session and fetch user data
    async function verifySession() {
      try {
        const response = await fetch(`${apiUrl}/admin/me`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Session invalid');
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error('Session verification failed:', error);
        // Redirect to login on session failure
        navigate('/login', { replace: true, state: { returnTo: basePath } });
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, [apiUrl, basePath, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Verifying session...</p>
          <p className="text-sm text-slate-400 mt-2">Pine Truist Finance Bank Internal Operations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <InternalHeader user={user} onLogout={handleLogout} />
      
      <div className="flex">
        <InternalSidebar userRole={user?.role} basePath={basePath} />
        
        <main className="flex-1 p-6">
          <Suspense fallback={<InternalLoadingSpinner />}>
            <Routes>
              <Route index element={<OverviewPage user={user} />} />
              <Route path="users/*" element={<UsersPage user={user} />} />
              <Route path="transactions/*" element={<TransactionsPage user={user} />} />
              <Route path="withdrawals/*" element={<WithdrawalsPage user={user} />} />
              <Route path="fraud-queue/*" element={<FraudQueuePage user={user} />} />
              <Route path="compliance/*" element={<CompliancePage user={user} />} />
              <Route path="audit/*" element={<AuditPage user={user} />} />
              <Route path="settings/*" element={<SettingsPage user={user} />} />
              <Route path="*" element={
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-gray-800">Page Not Found</h2>
                  <p className="text-gray-600 mt-2">The requested internal page does not exist.</p>
                  <Link to="." className="text-blue-600 hover:underline mt-4 inline-block">
                    Return to Overview
                  </Link>
                </div>
              } />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Security footer */}
      <footer className="bg-slate-900 text-slate-500 text-xs py-3 px-6">
        <div className="max-w-7xl mx-auto flex justify-between">
          <span>Pine Truist Finance Bank © {new Date().getFullYear()} - Internal Use Only</span>
          <span>All actions are logged and monitored</span>
        </div>
      </footer>
    </div>
  );
}
