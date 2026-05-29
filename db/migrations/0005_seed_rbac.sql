-- =====================================================================
-- 0005_seed_rbac.sql
-- Seed roles, permissions, role bindings, default system settings.
-- =====================================================================

INSERT INTO roles (name, description) VALUES
  ('customer',           'Standard banking customer'),
  ('support',            'Read-only customer support'),
  ('admin',              'Banking operations admin'),
  ('compliance_officer', 'BSA/AML compliance officer'),
  ('auditor',            'Read-only audit access'),
  ('super_admin',        'Full system access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (resource, action, description) VALUES
  ('account',     'read_self',  'Read own accounts'),
  ('transaction', 'read_self',  'Read own transactions'),
  ('transfer',    'initiate',   'Initiate transfers from own accounts'),
  ('withdrawal',  'request',    'Request withdrawals on own accounts'),
  ('user',        'read',       'Read user records'),
  ('user',        'write',      'Modify user records'),
  ('user',        'freeze',     'Freeze/unfreeze users'),
  ('role',        'assign',     'Assign roles to users'),
  ('pin',         'issue',      'Issue transfer PINs'),
  ('pin',         'revoke',     'Revoke transfer PINs'),
  ('withdrawal',  'approve',    'Approve/reject withdrawals'),
  ('transaction', 'release',    'Release flagged transactions'),
  ('transaction', 'reverse',    'Reverse transactions'),
  ('compliance',  'read',       'Read compliance cases'),
  ('compliance',  'write',      'Manage compliance cases'),
  ('audit',       'read',       'Query audit logs'),
  ('settings',    'write',      'Modify system settings'),
  ('*',           '*',          'Full access (super admin)')
ON CONFLICT (resource, action) DO NOTHING;

-- Bind customer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'customer'
  AND ((p.resource='account' AND p.action='read_self')
   OR (p.resource='transaction' AND p.action='read_self')
   OR (p.resource='transfer' AND p.action='initiate')
   OR (p.resource='withdrawal' AND p.action='request'))
ON CONFLICT DO NOTHING;

-- Support: read-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'support'
  AND ((p.resource='user' AND p.action='read')
   OR (p.resource='audit' AND p.action='read'))
ON CONFLICT DO NOTHING;

-- Admin: operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND (p.resource IN ('user','pin','withdrawal','transaction','settings','audit'))
ON CONFLICT DO NOTHING;

-- Compliance officer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'compliance_officer'
  AND ((p.resource='compliance')
   OR (p.resource='audit' AND p.action='read')
   OR (p.resource='user' AND p.action='read')
   OR (p.resource='user' AND p.action='freeze'))
ON CONFLICT DO NOTHING;

-- Auditor: read-only audit + read users
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'auditor'
  AND ((p.resource='audit' AND p.action='read')
   OR (p.resource='user' AND p.action='read')
   OR (p.resource='compliance' AND p.action='read'))
ON CONFLICT DO NOTHING;

-- Super admin: wildcard
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin' AND p.resource = '*' AND p.action = '*'
ON CONFLICT DO NOTHING;

-- ----- Default settings -----
INSERT INTO system_settings (key, value, description) VALUES
  ('limits.transfer.internal.daily', '"100000.00"', 'Per-user daily internal transfer ceiling.'),
  ('limits.transfer.ach.daily',      '"50000.00"',  'Per-user daily ACH outbound ceiling.'),
  ('limits.transfer.wire.daily',     '"250000.00"', 'Per-user daily wire ceiling.'),
  ('limits.withdrawal.daily',        '"25000.00"',  'Per-user daily withdrawal ceiling.'),
  ('fees.wire.domestic',             '"25.00"',     'Domestic wire transfer fee.'),
  ('fees.ach.standard',              '"0.00"',      'Standard ACH transfer fee.'),
  ('compliance.ctr.threshold',       '"10000.00"',  'CTR auto-generation threshold (BSA).'),
  ('fraud.wire.review_threshold',    '"25000.00"',  'Wire amount requiring admin co-sign.'),
  ('pin.default_ttl_minutes',        '30',          'Default PIN expiration (minutes).')
ON CONFLICT (key) DO NOTHING;
