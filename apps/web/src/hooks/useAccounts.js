import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useRealtime } from '../realtime/socket.js';

const BALANCE_EVENTS = [
  'transaction.posted',
  'balance.updated',
  'withdrawal.approved',
  'withdrawal.rejected',
];

/**
 * useAccounts — single source of truth for the customer's accounts.
 *
 * Centralises the `/accounts` fetch that every money-movement page previously
 * duplicated, and transparently refreshes balances on relevant realtime
 * events so the displayed account context stays accurate.
 *
 * @param {{ live?: boolean }} [opts] — when live (default) subscribe to
 *   balance-affecting realtime events and reload automatically.
 */
export function useAccounts({ live = true } = {}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await api('/accounts');
      setAccounts(a.accounts || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const liveHandlers = useMemo(
    () =>
      live
        ? BALANCE_EVENTS.reduce((acc, ev) => {
            acc[ev] = () => reload();
            return acc;
          }, {})
        : {},
    [live, reload],
  );
  useRealtime(liveHandlers);

  const totalAvailable = accounts.reduce(
    (sum, a) => sum + Number(a.balances?.available_balance || 0),
    0,
  );

  return { accounts, loading, error, reload, totalAvailable };
}
