import { create } from 'zustand';
import { api, clearTokens, getRefreshToken, setTokens } from '../api/client.js';

export const useAuth = create((set) => ({
  user: null,
  loading: true,
  async bootstrap() {
    try {
      const me = await api('/me');
      set({ user: me.user, roles: me.roles, permissions: me.permissions, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  async login({ email, password, mfaCode }) {
    const res = await api('/auth/login', { method: 'POST', body: { email, password, mfaCode } });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    set({ user: res.user, roles: res.user.roles, loading: false });
    return res.user;
  },
  async register({ email, password, fullName }) {
    return api('/auth/register', { method: 'POST', body: { email, password, fullName } });
  },
  async logout() {
    const rt = getRefreshToken();
    if (rt)
      await api('/auth/logout', { method: 'POST', body: { refreshToken: rt } }).catch(() => {});
    clearTokens();
    set({ user: null, roles: [], permissions: [] });
  },
}));
