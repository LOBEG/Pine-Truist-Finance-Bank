import React, { useState, useEffect } from 'react';

export default function FraudQueue({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/fraud/alerts?status=pending`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(alertId, resolution, notes = '') {
    setActionLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/fraud/alerts/${alertId}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, notes }),
      });
      
      if (response.ok) {
        fetchAlerts();
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error('Resolution error:', error);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fraud Investigation Queue</h1>
          <p className="text-gray-600">Review flagged transactions and suspicious activities</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} pending
          </span>
          <button
            onClick={fetchAlerts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Priority Banner */}
      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="bg-red-600 text-white p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-bold">Critical Alerts Require Immediate Attention</p>
              <p className="text-sm opacity-90">
                {alerts.filter(a => a.severity === 'critical').length} critical alert(s) in queue
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Grid */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading fraud alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <span className="text-6xl mb-4 block">✅</span>
          <h2 className="text-xl font-semibold text-gray-900">Queue Clear</h2>
          <p className="text-gray-500 mt-2">No pending fraud alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <FraudAlertCard
              key={alert.id}
              alert={alert}
              onSelect={setSelectedAlert}
            />
          ))}
        </div>
      )}

      {/* Investigation Modal */}
      {selectedAlert && (
        <InvestigationModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onResolve={handleResolve}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function FraudAlertCard({ alert, onSelect }) {
  const severityStyles = {
    critical: 'border-l-red-600 bg-red-50',
    high: 'border-l-orange-500 bg-orange-50',
    medium: 'border-l-yellow-500 bg-yellow-50',
    low: 'border-l-blue-500 bg-blue-50',
  };

  const severityBadge = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-blue-500 text-white',
  };

  return (
    <div className={`bg-white rounded-lg shadow border-l-4 ${severityStyles[alert.severity] || severityStyles.medium}`}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 text-xs font-bold uppercase rounded ${severityBadge[alert.severity]}`}>
                {alert.severity}
              </span>
              <span className="text-sm text-gray-500 font-mono">{alert.id?.slice(0, 12)}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{alert.title || alert.type}</h3>
            <p className="text-gray-600 mt-1">{alert.description}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Account</p>
                <p className="text-sm font-medium">{alert.accountNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Amount</p>
                <p className="text-sm font-medium font-mono">${(alert.amount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Detection Rule</p>
                <p className="text-sm font-medium">{alert.rule || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Detected</p>
                <p className="text-sm font-medium">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '—'}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => onSelect(alert)}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Investigate
          </button>
        </div>
      </div>
    </div>
  );
}

function InvestigationModal({ alert, onClose, onResolve, loading }) {
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');

  const resolutions = [
    { value: 'confirmed_fraud', label: 'Confirmed Fraud - Block Account', color: 'red' },
    { value: 'suspicious', label: 'Suspicious - Flag for Monitoring', color: 'orange' },
    { value: 'false_positive', label: 'False Positive - No Action', color: 'green' },
    { value: 'requires_customer_verification', label: 'Requires Customer Verification', color: 'blue' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 bg-slate-900 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Fraud Investigation</h2>
              <p className="text-slate-400 text-sm mt-1">{alert.id}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Alert Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{alert.title || alert.type}</h3>
            <p className="text-gray-600">{alert.description}</p>
          </div>

          {/* Evidence */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Evidence & Indicators</h3>
            <div className="space-y-2">
              {(alert.indicators || []).map((indicator, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-red-500">⚠️</span>
                  <span>{indicator}</span>
                </div>
              ))}
              {(!alert.indicators || alert.indicators.length === 0) && (
                <p className="text-gray-500 text-sm">No additional indicators available</p>
              )}
            </div>
          </div>

          {/* Transaction Details */}
          {alert.transactionDetails && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Transaction Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <pre>{JSON.stringify(alert.transactionDetails, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Resolution Selection */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Resolution</h3>
            <div className="space-y-2">
              {resolutions.map((res) => (
                <label
                  key={res.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    resolution === res.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={res.value}
                    checked={resolution === res.value}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mr-3"
                  />
                  <span>{res.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Investigation Notes */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Investigation Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document your investigation findings..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="4"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onResolve(alert.id, resolution, notes)}
              disabled={!resolution || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Submit Resolution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
