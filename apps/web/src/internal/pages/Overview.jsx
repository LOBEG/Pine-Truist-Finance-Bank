import React, { useState, useEffect } from 'react';

export default function Overview({ user }) {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    async function fetchOverviewData() {
      try {
        const [statsRes, activityRes] = await Promise.all([
          fetch(`${apiUrl}/admin/stats`, { credentials: 'include' }),
          fetch(`${apiUrl}/admin/activity?limit=10`, { credentials: 'include' }),
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
        if (activityRes.ok) {
          setRecentActivity(await activityRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch overview data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOverviewData();
  }, [apiUrl]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
          <p className="text-gray-600">Welcome back, {user?.name || 'Operator'}</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Users"
          value={stats?.activeUsers ?? '—'}
          change="+12%"
          changeType="positive"
          icon="👥"
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats?.pendingWithdrawals ?? '—'}
          change={stats?.pendingWithdrawals > 10 ? 'Requires attention' : 'Normal'}
          changeType={stats?.pendingWithdrawals > 10 ? 'warning' : 'neutral'}
          icon="💸"
        />
        <StatCard
          title="Fraud Alerts"
          value={stats?.fraudAlerts ?? '—'}
          change={stats?.fraudAlerts > 0 ? 'Action needed' : 'All clear'}
          changeType={stats?.fraudAlerts > 0 ? 'negative' : 'positive'}
          icon="🚨"
        />
        <StatCard
          title="Transactions Today"
          value={stats?.transactionsToday ?? '—'}
          change={`$${(stats?.volumeToday ?? 0).toLocaleString()}`}
          changeType="neutral"
          icon="💳"
        />
      </div>

      {/* Alerts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h2>
        <div className="space-y-3">
          {stats?.alerts?.length > 0 ? (
            stats.alerts.map((alert, index) => (
              <AlertItem key={index} alert={alert} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No active alerts</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <ActivityItem key={index} activity={activity} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No recent activity</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          title="Review Withdrawals"
          description="Pending approval queue"
          action="Review Now"
          href="withdrawals"
          icon="💸"
        />
        <QuickActionCard
          title="Fraud Queue"
          description="Flagged transactions"
          action="Investigate"
          href="fraud-queue"
          icon="🚨"
        />
        <QuickActionCard
          title="Compliance Check"
          description="Reports and monitoring"
          action="View Reports"
          href="compliance"
          icon="📋"
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, change, changeType, icon }) {
  const changeColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    warning: 'text-amber-600',
    neutral: 'text-gray-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-sm ${changeColors[changeType]}`}>{change}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function AlertItem({ alert }) {
  const severityColors = {
    high: 'bg-red-100 border-red-500 text-red-800',
    medium: 'bg-amber-100 border-amber-500 text-amber-800',
    low: 'bg-blue-100 border-blue-500 text-blue-800',
  };

  return (
    <div className={`p-3 rounded-lg border-l-4 ${severityColors[alert.severity] || severityColors.low}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{alert.message}</span>
        <span className="text-xs uppercase">{alert.severity}</span>
      </div>
      <p className="text-sm mt-1 opacity-75">{alert.timestamp}</p>
    </div>
  );
}

function ActivityItem({ activity }) {
  return (
    <div className="flex items-center space-x-4 py-2 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        {activity.icon || '📌'}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
        <p className="text-xs text-gray-500">{activity.actor} • {activity.timestamp}</p>
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, action, href, icon }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-semibold text-gray-900 mt-2">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <a
        href={href}
        className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
      >
        {action}
      </a>
    </div>
  );
}
