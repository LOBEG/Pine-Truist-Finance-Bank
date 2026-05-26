import React, { useState, useEffect } from 'react';

export default function Audit({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    actor: '',
    dateRange: '7d',
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 50 });

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, filters]);

  async function fetchAuditLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });

      const response = await fetch(`${apiUrl}/admin/audit?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  async function exportLogs() {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });

      const response = await fetch(`${apiUrl}/admin/audit/export?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600">Complete record of all system activities</p>
        </div>
        <button
          onClick={exportLogs}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="user.create">User Created</option>
            <option value="user.update">User Updated</option>
            <option value="user.delete">User Deleted</option>
            <option value="transaction.create">Transaction Created</option>
            <option value="withdrawal.approve">Withdrawal Approved</option>
            <option value="withdrawal.reject">Withdrawal Rejected</option>
            <option value="settings.update">Settings Updated</option>
            <option value="mfa.enable">MFA Enabled</option>
            <option value="mfa.disable">MFA Disabled</option>
          </select>

          <input
            type="text"
            placeholder="Filter by actor..."
            value={filters.actor}
            onChange={(e) => handleFilterChange('actor', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          <button
            onClick={fetchAuditLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading audit logs...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <AuditLogRow key={log.id} log={log} />
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No audit logs found matching filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
        <strong>📋 Audit Compliance Notice:</strong> All audit logs are immutable and retained for 7 years in accordance with regulatory requirements.
        Logs are encrypted at rest and in transit. Access to this page is logged.
      </div>
    </div>
  );
}

function AuditLogRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  const actionColors = {
    login: 'bg-blue-100 text-blue-800',
    logout: 'bg-gray-100 text-gray-800',
    create: 'bg-green-100 text-green-800',
    update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800',
    approve: 'bg-green-100 text-green-800',
    reject: 'bg-red-100 text-red-800',
  };

  const getActionColor = (action) => {
    const key = Object.keys(actionColors).find(k => action?.includes(k));
    return actionColors[key] || 'bg-gray-100 text-gray-800';
  };

  const statusColors = {
    success: 'text-green-600',
    failure: 'text-red-600',
    warning: 'text-yellow-600',
  };

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
        </td>
        <td className="px-6 py-4">
          <div className="text-sm font-medium text-gray-900">{log.actorName || log.actor}</div>
          <div className="text-xs text-gray-500">{log.actorRole}</div>
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
            {log.action || 'unknown'}
          </span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          <span className="font-mono">{log.resourceType}</span>
          {log.resourceId && (
            <span className="text-gray-400 ml-1">#{log.resourceId.slice(0, 8)}</span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
          {log.ipAddress || '—'}
        </td>
        <td className="px-6 py-4">
          <span className={`text-sm font-medium ${statusColors[log.status] || 'text-gray-600'}`}>
            {log.status === 'success' ? '✓' : log.status === 'failure' ? '✗' : '⚠'} {log.status}
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="7" className="px-6 py-4 bg-gray-50">
            <div className="text-sm">
              <h4 className="font-medium text-gray-900 mb-2">Details</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(log.details || log, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
