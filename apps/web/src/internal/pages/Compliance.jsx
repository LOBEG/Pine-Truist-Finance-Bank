import React, { useState, useEffect } from 'react';

export default function Compliance({ user }) {
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchComplianceData();
  }, []);

  async function fetchComplianceData() {
    setLoading(true);
    try {
      const [reportsRes, alertsRes] = await Promise.all([
        fetch(`${apiUrl}/admin/compliance/reports`, { credentials: 'include' }),
        fetch(`${apiUrl}/admin/compliance/alerts`, { credentials: 'include' }),
      ]);

      if (reportsRes.ok) setReports(await reportsRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports' },
    { key: 'alerts', label: 'Alerts' },
    { key: 'sars', label: 'SAR Filing' },
    { key: 'kyc', label: 'KYC/AML' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Center</h1>
          <p className="text-gray-600">Regulatory monitoring and reporting</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          📄 Generate Report
        </button>
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
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading compliance data...</p>
        </div>
      ) : (
        <>
          {selectedTab === 'overview' && <OverviewTab alerts={alerts} />}
          {selectedTab === 'reports' && <ReportsTab reports={reports} />}
          {selectedTab === 'alerts' && <AlertsTab alerts={alerts} />}
          {selectedTab === 'sars' && <SARFilingTab />}
          {selectedTab === 'kyc' && <KYCAMLTab />}
        </>
      )}
    </div>
  );
}

function OverviewTab({ alerts }) {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatusCard title="Compliance Score" value="94%" status="good" />
        <StatusCard
          title="Pending Reviews"
          value="12"
          status={criticalAlerts > 0 ? 'warning' : 'good'}
        />
        <StatusCard title="SAR Filings (YTD)" value="8" status="neutral" />
        <StatusCard title="KYC Pending" value="23" status="warning" />
      </div>

      {/* Regulatory Deadlines */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h2>
        <div className="space-y-3">
          <DeadlineItem title="Quarterly BSA Report" date="2024-03-31" status="on_track" />
          <DeadlineItem title="Annual AML Risk Assessment" date="2024-04-15" status="at_risk" />
          <DeadlineItem title="OFAC List Update Review" date="2024-03-20" status="completed" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Compliance Activity</h2>
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    alert.severity === 'critical'
                      ? 'bg-red-500'
                      : alert.severity === 'high'
                        ? 'bg-orange-500'
                        : 'bg-yellow-500'
                  }`}
                ></span>
                <span className="text-sm">{alert.description}</span>
              </div>
              <span className="text-xs text-gray-500">{alert.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, status }) {
  const statusColors = {
    good: 'border-green-500 bg-green-50',
    warning: 'border-yellow-500 bg-yellow-50',
    critical: 'border-red-500 bg-red-50',
    neutral: 'border-gray-300 bg-gray-50',
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 ${statusColors[status]}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function DeadlineItem({ title, date, status }) {
  const statusIcons = {
    completed: '✅',
    on_track: '🟢',
    at_risk: '🟠',
    overdue: '🔴',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span>{statusIcons[status] || '📅'}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className="text-sm text-gray-500">{date}</span>
    </div>
  );
}

function ReportsTab({ reports }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Report
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Generated
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {reports.length > 0 ? (
            reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{report.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{report.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{report.generatedAt}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:text-blue-900 text-sm">Download</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                No reports available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AlertsTab({ alerts }) {
  return (
    <div className="space-y-4">
      {alerts.length > 0 ? (
        alerts.map((alert) => (
          <div key={alert.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold uppercase rounded ${
                      alert.severity === 'critical'
                        ? 'bg-red-600 text-white'
                        : alert.severity === 'high'
                          ? 'bg-orange-500 text-white'
                          : 'bg-yellow-500'
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-sm text-gray-500">{alert.type}</span>
                </div>
                <p className="mt-2 text-gray-900">{alert.description}</p>
                <p className="text-sm text-gray-500 mt-1">{alert.timestamp}</p>
              </div>
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Review
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No compliance alerts
        </div>
      )}
    </div>
  );
}

function SARFilingTab() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Suspicious Activity Report Filing
      </h2>
      <p className="text-gray-600 mb-6">
        File Suspicious Activity Reports (SARs) with FinCEN for transactions or activities that may
        involve money laundering or other financial crimes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900">Draft SARs</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">3</p>
          <button className="mt-4 text-blue-600 hover:text-blue-900 text-sm">View Drafts →</button>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900">Filed (This Quarter)</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">5</p>
          <button className="mt-4 text-blue-600 hover:text-blue-900 text-sm">View History →</button>
        </div>
      </div>

      <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        + Create New SAR
      </button>
    </div>
  );
}

function KYCAMLTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">KYC/AML Monitoring</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatusCard title="Pending KYC Reviews" value="23" status="warning" />
          <StatusCard title="Enhanced Due Diligence" value="5" status="critical" />
          <StatusCard title="Completed Today" value="12" status="good" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">OFAC Screening</h2>
        <p className="text-gray-600 mb-4">
          Real-time screening against OFAC Specially Designated Nationals (SDN) list.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-green-600">
            <span>✓</span>
            <span>Last updated: Today at 06:00 AM EST</span>
          </div>
          <button className="text-blue-600 hover:text-blue-900 text-sm">Run Manual Check</button>
        </div>
      </div>
    </div>
  );
}
