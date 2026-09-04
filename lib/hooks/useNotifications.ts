'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Todo } from '@/lib/db';
import { formatSingaporeDateTime } from '@/lib/timezone';

const POLL_INTERVAL_MS = 30_000;

// Browser-based due-date reminders. Polls `/api/notifications/check` (which
// performs all due/timing comparisons server-side in Singapore time) and
// fires a native Notification for each todo whose reminder window has
// opened. All exactly-once bookkeeping is server-side via
// `last_notification_sent`; this hook is purely the polling trigger.
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (permission !== 'granted') {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const res = await fetch('/api/notifications/check');
      if (!res.ok || cancelled) return;

      const { data: dueTodos } = (await res.json()) as { data: Todo[] };

      for (const todo of dueTodos) {
        if (Notification.permission === 'granted') {
          new Notification(todo.title, {
            body: todo.due_date ? `Due ${formatSingaporeDateTime(todo.due_date)}` : undefined,
            // Coalesces duplicate OS notifications for the same todo across
            // tabs/poll ticks; see edge cases in PRP 04.
            tag: `todo-${todo.id}`,
          });
        }

        await fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_notification_sent: new Date().toISOString() }),
        });
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [permission]);

  return { permission, requestPermission };
}
