import React, { useState, useEffect } from 'react';

export default function Settings({ user }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('security');
  const [message, setMessage] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/settings`, {
        credentials: 'include',
      });
      if (response.ok) {
        setSettings(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(section, data) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/admin/settings/${section}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        fetchSettings();
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  }

  // Only super_admin can access settings
  if (user?.role !== 'super_admin') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <span className="text-4xl mb-4 block">🔒</span>
        <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
        <p className="text-red-600 mt-2">Only super administrators can access system settings.</p>
      </div>
    );
  }

  const sections = [
    { key: 'security', label: 'Security', icon: '🔐' },
    { key: 'limits', label: 'Transaction Limits', icon: '💰' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'compliance', label: 'Compliance', icon: '📋' },
    { key: 'api', label: 'API & Integrations', icon: '🔌' },
    { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Configure system-wide settings and policies</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-medium text-amber-800">Caution: Critical Settings</p>
          <p className="text-sm text-amber-700">Changes to these settings affect all users and operations. Review carefully before saving.</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="bg-white rounded-lg shadow p-4 space-y-1">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === section.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeSection === 'security' && (
            <SecuritySettings settings={settings?.security} onSave={(data) => saveSettings('security', data)} saving={saving} />
          )}
          {activeSection === 'limits' && (
            <LimitsSettings settings={settings?.limits} onSave={(data) => saveSettings('limits', data)} saving={saving} />
          )}
          {activeSection === 'notifications' && (
            <NotificationsSettings settings={settings?.notifications} onSave={(data) => saveSettings('notifications', data)} saving={saving} />
          )}
          {activeSection === 'compliance' && (
            <ComplianceSettings settings={settings?.compliance} onSave={(data) => saveSettings('compliance', data)} saving={saving} />
          )}
          {activeSection === 'api' && (
            <APISettings settings={settings?.api} onSave={(data) => saveSettings('api', data)} saving={saving} />
          )}
          {activeSection === 'maintenance' && (
            <MaintenanceSettings settings={settings?.maintenance} onSave={(data) => saveSettings('maintenance', data)} saving={saving} />
          )}
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ settings, onSave, saving }) {
  const [formData, setFormData] = useState({
    mfaRequired: settings?.mfaRequired ?? true,
    sessionTimeout: settings?.sessionTimeout ?? 30,
    maxLoginAttempts: settings?.maxLoginAttempts ?? 5,
    passwordMinLength: settings?.passwordMinLength ?? 12,
    ipAllowlistEnabled: settings?.ipAllowlistEnabled ?? false,
    allowedIPs: settings?.allowedIPs?.join('\n') ?? '',
  });

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>

      <div className="space-y-4">
        <ToggleSetting
          label="Require MFA for Internal Users"
          description="All internal users must have MFA enabled"
          checked={formData.mfaRequired}
          onChange={(v) => setFormData(prev => ({ ...prev, mfaRequired: v }))}
        />

        <NumberSetting
          label="Session Timeout (minutes)"
          value={formData.sessionTimeout}
          onChange={(v) => setFormData(prev => ({ ...prev, sessionTimeout: v }))}
          min={5}
          max={120}
        />

        <NumberSetting
          label="Max Login Attempts"
          value={formData.maxLoginAttempts}
          onChange={(v) => setFormData(prev => ({ ...prev, maxLoginAttempts: v }))}
          min={3}
          max={10}
        />

        <NumberSetting
          label="Minimum Password Length"
          value={formData.passwordMinLength}
          onChange={(v) => setFormData(prev => ({ ...prev, passwordMinLength: v }))}
          min={8}
          max={32}
        />

        <ToggleSetting
          label="IP Allowlist"
          description="Restrict admin access to specific IP addresses"
          checked={formData.ipAllowlistEnabled}
          onChange={(v) => setFormData(prev => ({ ...prev, ipAllowlistEnabled: v }))}
        />

        {formData.ipAllowlistEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed IP Addresses (one per line, supports CIDR notation)
            </label>
            <textarea
              value={formData.allowedIPs}
              onChange={(e) => setFormData(prev => ({ ...prev, allowedIPs: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              rows="5"
              placeholder="192.168.1.0/24&#10;10.0.0.1"
            />
          </div>
        )}
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={() => onSave({ ...formData, allowedIPs: formData.allowedIPs.split('\n').filter(ip => ip.trim()) })}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
}

function LimitsSettings({ settings, onSave, saving }) {
  const [formData, setFormData] = useState({
    dailyWithdrawalLimit: settings?.dailyWithdrawalLimit ?? 10000,
    dailyTransferLimit: settings?.dailyTransferLimit ?? 25000,
    singleTransactionLimit: settings?.singleTransactionLimit ?? 5000,
    requireApprovalAbove: settings?.requireApprovalAbove ?? 2500,
  });

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Transaction Limits</h2>

      <div className="space-y-4">
        <CurrencySetting
          label="Daily Withdrawal Limit"
          value={formData.dailyWithdrawalLimit}
          onChange={(v) => setFormData(prev => ({ ...prev, dailyWithdrawalLimit: v }))}
        />
        <CurrencySetting
          label="Daily Transfer Limit"
          value={formData.dailyTransferLimit}
          onChange={(v) => setFormData(prev => ({ ...prev, dailyTransferLimit: v }))}
        />
        <CurrencySetting
          label="Single Transaction Limit"
          value={formData.singleTransactionLimit}
          onChange={(v) => setFormData(prev => ({ ...prev, singleTransactionLimit: v }))}
        />
        <CurrencySetting
          label="Require Approval Above"
          description="Transactions above this amount require manual approval"
          value={formData.requireApprovalAbove}
          onChange={(v) => setFormData(prev => ({ ...prev, requireApprovalAbove: v }))}
        />
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={() => onSave(formData)}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Limit Settings'}
        </button>
      </div>
    </div>
  );
}

function NotificationsSettings({ settings, onSave, saving }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
      <p className="text-gray-500">Configure email, SMS, and push notification settings.</p>
      <p className="text-sm text-gray-400 mt-4">Coming soon...</p>
    </div>
  );
}

function ComplianceSettings({ settings, onSave, saving }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Settings</h2>
      <p className="text-gray-500">Configure AML/KYC thresholds and reporting settings.</p>
      <p className="text-sm text-gray-400 mt-4">Coming soon...</p>
    </div>
  );
}

function APISettings({ settings, onSave, saving }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">API & Integrations</h2>
      <p className="text-gray-500">Manage API keys and third-party integrations.</p>
      <p className="text-sm text-gray-400 mt-4">Coming soon...</p>
    </div>
  );
}

function MaintenanceSettings({ settings, onSave, saving }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Mode</h2>
      <p className="text-gray-500">Enable maintenance mode to temporarily disable customer access.</p>
      <p className="text-sm text-gray-400 mt-4">Coming soon...</p>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function NumberSetting({ label, value, onChange, min, max }) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="font-medium text-gray-900">{label}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        min={min}
        max={max}
        className="w-24 px-3 py-1 border border-gray-300 rounded-lg text-right"
      />
    </div>
  );
}

function CurrencySetting({ label, description, value, onChange }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        <div className="flex items-center">
          <span className="text-gray-500 mr-2">$</span>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-32 px-3 py-1 border border-gray-300 rounded-lg text-right"
          />
        </div>
      </div>
    </div>
  );
}
