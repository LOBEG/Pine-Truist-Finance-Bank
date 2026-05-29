import { useEffect } from 'react';
import { useNotifications } from '../store/notifications.js';
import { useRealtime } from '../realtime/socket.js';
import { api } from '../api/client.js';
import { formatDate, formatMoney } from '../api/format.js';

const REALTIME_EVENTS = [
  'transaction.posted',
  'transaction.created',
  'transaction.flagged',
  'balance.updated',
  'withdrawal.approved',
  'withdrawal.rejected',
  'withdrawal.requested',
];

export function Notifications() {
  const { items, unread, push, seed, markAllRead } = useNotifications();

  // Seed from recent transactions on first load
  useEffect(() => {
    api('/transactions?limit=40')
      .then((r) => seed(r.items))
      .catch(() => {});
  }, [seed]);

  // Mark all read on mount
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // Build realtime handlers object — stable reference via reduce
  const handlers = REALTIME_EVENTS.reduce((acc, ev) => {
    acc[ev] = (payload) => push(ev, payload);
    return acc;
  }, {});

  useRealtime(handlers);

  // Group notifications by calendar date
  const groups = groupByDate(items);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pine-900">Notifications</h1>
          <p className="text-pine-700 text-sm mt-1">Real-time activity on your accounts.</p>
        </div>
        {unread > 0 && (
          <span className="badge bg-pine-700 text-white text-sm px-3 py-1">{unread} new</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card text-pine-700 text-sm">
          No notifications yet. Activity will appear here in real time.
        </div>
      ) : (
        Object.entries(groups).map(([date, notes]) => (
          <section key={date}>
            <h2 className="text-xs font-semibold text-pine-600 uppercase tracking-wide mb-2">
              {date}
            </h2>
            <div className="space-y-2">
              {notes.map((n) => (
                <NotificationRow key={n.id} note={n} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function NotificationRow({ note }) {
  return (
    <div
      className={`card flex items-start gap-4 py-4 px-4 ${note.read ? '' : 'ring-2 ring-pine-300 bg-pine-50'}`}
    >
      <span className="text-2xl leading-none mt-0.5" aria-hidden="true">
        {note.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-pine-900 text-sm truncate">{note.title}</p>
          {note.amount && (
            <p className="text-sm font-semibold text-pine-800 whitespace-nowrap">
              {formatMoney(note.amount)}
            </p>
          )}
        </div>
        {note.transactionId && (
          <p className="text-xs text-pine-600 font-mono truncate mt-0.5">{note.transactionId}</p>
        )}
        <p className="text-xs text-pine-500 mt-0.5">{formatDate(note.at)}</p>
      </div>
    </div>
  );
}

function groupByDate(items) {
  const groups = {};
  for (const n of items) {
    const d = new Date(n.at);
    const key = d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  }
  return groups;
}
