import React, { useState, useEffect } from 'react';

export default function Withdrawals({ user }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchWithdrawals();
  }, [selectedTab]);

  async function fetchWithdrawals() {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/withdrawals?status=${selectedTab}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(withdrawalId, action, reason = '') {
    setActionLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/withdrawals/${withdrawalId}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        fetchWithdrawals();
        setSelectedWithdrawal(null);
      } else {
        console.error('Action failed');
      }
    } catch (error) {
      console.error('Action error:', error);
    } finally {
      setActionLoading(false);
    }
  }

  const tabs = [
    { key: 'pending', label: 'Pending Review', icon: '⏳' },
    { key: 'approved', label: 'Approved', icon: '✅' },
    { key: 'rejected', label: 'Rejected', icon: '❌' },
    { key: 'completed', label: 'Completed', icon: '💵' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Withdrawal Approvals</h1>
          <p className="text-gray-600">Review and approve customer withdrawal requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Withdrawals List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading withdrawals...</p>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No {selectedTab} withdrawals</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {withdrawals.map((w) => (
                <WithdrawalRow
                  key={w.id}
                  withdrawal={w}
                  onSelect={setSelectedWithdrawal}
                  isPending={selectedTab === 'pending'}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval Modal */}
      {selectedWithdrawal && (
        <WithdrawalModal
          withdrawal={selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
          onApprove={(id) => handleAction(id, 'approve')}
          onReject={(id, reason) => handleAction(id, 'reject', reason)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function WithdrawalRow({ withdrawal, onSelect, isPending }) {
  const riskColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };

  return (
    <tr className={`hover:bg-gray-50 ${withdrawal.riskLevel === 'high' ? 'bg-red-50' : ''}`}>
      <td className="px-6 py-4 text-sm font-mono text-gray-900">
        {withdrawal.id?.slice(0, 8) || '—'}
      </td>
      <td className="px-6 py-4">
        <div>
          <div className="text-sm font-medium text-gray-900">{withdrawal.customerName}</div>
          <div className="text-sm text-gray-500">{withdrawal.accountNumber}</div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-900">
        ${(withdrawal.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{withdrawal.method || 'Bank Transfer'}</td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : '—'}
      </td>
      <td className="px-6 py-4">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${riskColors[withdrawal.riskLevel] || riskColors.low}`}
        >
          {withdrawal.riskLevel || 'low'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onSelect(withdrawal)}
          className={`text-sm font-medium ${
            isPending ? 'text-blue-600 hover:text-blue-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {isPending ? 'Review' : 'View Details'}
        </button>
      </td>
    </tr>
  );
}

function WithdrawalModal({ withdrawal, onClose, onApprove, onReject, loading }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Withdrawal Request Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Withdrawal Details */}
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Request ID" value={withdrawal.id} />
            <DetailItem
              label="Amount"
              value={`$${(withdrawal.amount || 0).toLocaleString()}`}
              highlight
            />
            <DetailItem label="Customer" value={withdrawal.customerName} />
            <DetailItem label="Account" value={withdrawal.accountNumber} />
            <DetailItem label="Method" value={withdrawal.method} />
            <DetailItem label="Risk Level" value={withdrawal.riskLevel} />
            <DetailItem
              label="Current Balance"
              value={`$${(withdrawal.currentBalance || 0).toLocaleString()}`}
            />
            <DetailItem
              label="Requested"
              value={withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : '—'}
            />
          </div>

          {/* Risk Factors */}
          {withdrawal.riskFactors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2">⚠️ Risk Factors</h3>
              <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                {withdrawal.riskFactors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                rows="3"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            {!showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  disabled={loading}
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(withdrawal.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Approve'}
                </button>
              </>
            ) : (
              <button
                onClick={() => onReject(withdrawal.id, rejectReason)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={loading || !rejectReason.trim()}
              >
                {loading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-sm mt-1 ${highlight ? 'text-lg font-bold text-gray-900' : 'font-medium text-gray-900'}`}
      >
        {value || '—'}
      </p>
    </div>
  );
}
