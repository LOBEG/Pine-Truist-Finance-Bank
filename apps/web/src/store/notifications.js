import { create } from 'zustand';

/**
 * Client-side notification store.
 * Notifications are accumulated from:
 *   1. Real-time WebSocket events pushed from the gateway.
 *   2. An initial pull of recent transactions on page load.
 *
 * Each notification has the shape:
 *   { id, type, title, body, amount, accountId, at, read }
 */
export const useNotifications = create((set, get) => ({
  items: [],
  unread: 0,

  /** Add a notification from a realtime event payload. */
  push(type, payload) {
    const id = payload.transactionId || payload.withdrawalId || `${type}-${Date.now()}`;
    // Deduplicate
    if (get().items.some((n) => n.id === id)) return;
    const note = buildNote(type, payload, id);
    set((s) => ({
      items: [note, ...s.items].slice(0, 200),
      unread: s.unread + 1,
    }));
  },

  /** Prepopulate with items fetched from the transactions API. */
  seed(transactions) {
    const notes = transactions
      .map((t) =>
        buildNote(
          t.type,
          { transactionId: t.id, amount: t.amount, accountId: t.account_id },
          t.id,
          t.created_at,
        ),
      )
      .filter(Boolean);
    set((s) => {
      const existingIds = new Set(s.items.map((n) => n.id));
      const fresh = notes.filter((n) => !existingIds.has(n.id));
      return { items: [...s.items, ...fresh].slice(0, 200) };
    });
  },

  markAllRead() {
    set((s) => ({
      items: s.items.map((n) => ({ ...n, read: true })),
      unread: 0,
    }));
  },
}));

const TYPE_META = {
  'transaction.posted': { title: 'Transaction posted', icon: '✅' },
  'transaction.created': { title: 'Transaction created', icon: '🔄' },
  'transaction.flagged': { title: 'Transaction under review', icon: '⚠️' },
  'balance.updated': { title: 'Balance updated', icon: '💰' },
  'withdrawal.approved': { title: 'Withdrawal approved', icon: '✅' },
  'withdrawal.rejected': { title: 'Withdrawal rejected', icon: '❌' },
  'withdrawal.requested': { title: 'Withdrawal requested', icon: '📤' },
  internal_transfer: { title: 'Internal transfer', icon: '↔️' },
  ach_credit: { title: 'ACH credit received', icon: '📥' },
  ach_debit: { title: 'ACH debit sent', icon: '📤' },
  wire_domestic: { title: 'Domestic wire', icon: '🏦' },
  deposit: { title: 'Deposit received', icon: '📥' },
  withdrawal: { title: 'Withdrawal', icon: '📤' },
  fee: { title: 'Fee charged', icon: '💲' },
  interest: { title: 'Interest credited', icon: '📈' },
  reversal: { title: 'Transaction reversed', icon: '↩️' },
};

function buildNote(type, payload, id, at) {
  const meta = TYPE_META[type] || { title: type, icon: '🔔' };
  return {
    id,
    type,
    title: meta.title,
    icon: meta.icon,
    amount: payload.amount || null,
    accountId: payload.accountId || payload.sourceAccountId || null,
    transactionId: payload.transactionId || null,
    at: at || new Date().toISOString(),
    read: false,
  };
}
