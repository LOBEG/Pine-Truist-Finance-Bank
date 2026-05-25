const API = import.meta.env.PINE_API_URL || '/api/v1';

// Tokens are kept in module-level memory only. The previous implementation
// persisted the refresh token to `localStorage`, which is reachable by any
// XSS vector running on the page; a single content-injection bug could
// drain customer funds. Refresh tokens now live for the lifetime of the
// page only — re-authentication is required after a hard reload. The
// long-term fix (tracked in docs/PRODUCTION_READINESS.md) is to deliver
// the refresh token in an HttpOnly Secure SameSite=Strict cookie issued
// by /auth/login, which removes refresh tokens from JS entirely.
let memoryAccess = null;
let memoryRefresh = null;

export function setTokens({ accessToken, refreshToken }) {
  memoryAccess = accessToken || null;
  memoryRefresh = refreshToken || memoryRefresh || null;
}

export function clearTokens() {
  memoryAccess = null;
  memoryRefresh = null;
}

export function getAccessToken() {
  return memoryAccess;
}
export function getRefreshToken() {
  return memoryRefresh;
}

// Reads the double-submit CSRF token issued by the server via the
// `__Host-csrf` cookie. Required for every state-changing request.
function readCsrfToken() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)__Host-csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function refreshAccess() {
  if (!memoryRefresh) throw new Error('no_refresh');
  const csrf = readCsrfToken();
  const r = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: JSON.stringify({ refreshToken: memoryRefresh }),
  });
  if (!r.ok) {
    clearTokens();
    throw new Error('refresh_failed');
  }
  const j = await r.json();
  setTokens({ accessToken: j.accessToken, refreshToken: j.refreshToken });
  return j.accessToken;
}

export async function api(path, { method = 'GET', body, headers = {}, idempotencyKey } = {}) {
  const doFetch = async (token) => {
    const csrf = UNSAFE_METHODS.has(method) ? readCsrfToken() : null;
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...headers,
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(`${API}${path}`, opts);
  };

  let res = await doFetch(memoryAccess);
  if (res.status === 401 && memoryRefresh) {
    try {
      const token = await refreshAccess();
      res = await doFetch(token);
    } catch {
      /* fall through */
    }
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw Object.assign(new Error(problem.title || `HTTP ${res.status}`), {
      status: res.status,
      code: problem.code,
      detail: problem.detail,
    });
  }
  if (res.status === 204) return null;
  return res.json();
}

export function newIdempotencyKey() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
