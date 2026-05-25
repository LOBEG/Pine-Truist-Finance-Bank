const API = import.meta.env.PINE_API_URL || '/api/v1';

let memoryAccess;
let memoryRefresh;
const REFRESH_KEY = 'pine.refresh';
const ACCESS_KEY = 'pine.access';

function loadTokens() {
  if (memoryAccess === undefined) memoryAccess = sessionStorage.getItem(ACCESS_KEY) || null;
  if (memoryRefresh === undefined) memoryRefresh = localStorage.getItem(REFRESH_KEY) || null;
}
loadTokens();

export function setTokens({ accessToken, refreshToken }) {
  memoryAccess = accessToken || null;
  memoryRefresh = refreshToken || memoryRefresh || null;
  if (accessToken) sessionStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  memoryAccess = null;
  memoryRefresh = null;
  sessionStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return memoryAccess;
}
export function getRefreshToken() {
  return memoryRefresh;
}

async function refreshAccess() {
  if (!memoryRefresh) throw new Error('no_refresh');
  const r = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
    const opts = {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
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
