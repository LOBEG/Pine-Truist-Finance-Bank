import React, { useState, useEffect } from 'react';

export default function Transactions({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    dateRange: '7d',
    minAmount: '',
    maxAmount: '',
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 25 });

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });

      const response = await fetch(`${apiUrl}/admin/transactions?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setPagination((prev) => ({ ...prev, total: data.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Monitor</h1>
          <p className="text-gray-600">View and investigate all transactions</p>
        </div>
        <button
          onClick={() => fetchTransactions()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="transfer">Transfer</option>
            <option value="payment">Payment</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="flagged">Flagged</option>
            <option value="reversed">Reversed</option>
          </select>

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

          <input
            type="number"
            placeholder="Min Amount"
            value={filters.minAmount}
            onChange={(e) => handleFilterChange('minAmount', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            placeholder="Max Amount"
            value={filters.maxAmount}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading transactions...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  From
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length > 0 ? (
                transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No transactions found matching filters
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
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              transactions
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ transaction }) {
  const typeColors = {
    deposit: 'bg-green-100 text-green-800',
    withdrawal: 'bg-amber-100 text-amber-800',
    transfer: 'bg-blue-100 text-blue-800',
    payment: 'bg-purple-100 text-purple-800',
  };

  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    flagged: 'bg-red-100 text-red-800 border border-red-400',
    reversed: 'bg-gray-100 text-gray-800',
  };

  return (
    <tr className={`hover:bg-gray-50 ${transaction.status === 'flagged' ? 'bg-red-50' : ''}`}>
      <td className="px-6 py-4 text-sm font-mono text-gray-900">
        {transaction.id?.slice(0, 8) || '—'}
      </td>
      <td className="px-6 py-4">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[transaction.type] || 'bg-gray-100 text-gray-800'}`}
        >
          {transaction.type || 'unknown'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-900">
        ${(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{transaction.fromAccount || '—'}</td>
      <td className="px-6 py-4 text-sm text-gray-500">{transaction.toAccount || '—'}</td>
      <td className="px-6 py-4">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[transaction.status] || 'bg-gray-100'}`}
        >
          {transaction.status === 'flagged' && '🚩 '}
          {transaction.status || 'unknown'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : '—'}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">Details</button>
          {transaction.status === 'flagged' && (
            <button className="text-red-600 hover:text-red-900 text-sm font-medium">Review</button>
          )}
        </div>
      </td>
    </tr>
  );
}
