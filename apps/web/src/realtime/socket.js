import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../api/client.js';

const URL = import.meta.env.PINE_REALTIME_URL || '';

let socket;
export function getSocket() {
  if (socket) return socket;
  const token = getAccessToken();
  if (!token) return null;
  socket = io(URL || '/', {
    path: '/realtime',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

export function useRealtime(handlers) {
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const subs = Object.entries(handlers);
    subs.forEach(([ev, fn]) => s.on(ev, fn));
    return () => subs.forEach(([ev, fn]) => s.off(ev, fn));
  }, [handlers]);
}
