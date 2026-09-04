'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Priority, RecurrencePattern, ReminderMinutes, Todo } from '@/lib/db';
import { useNotifications } from '@/lib/hooks/useNotifications';

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const RECURRENCE_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const REMINDER_OPTIONS: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];
// Mirrors `REMINDER_LABELS` in lib/db.ts. Redefined locally (rather than
// imported) because lib/db.ts initializes better-sqlite3 at module scope,
// which cannot be pulled into a client bundle -- see "Never import lib/db.ts
// directly in client components" in the project conventions.
const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
};

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function sectionTodos(todos: Todo[], now: Date) {
  const incomplete = todos.filter((t) => !t.completed);
  const overdue = sortTodos(incomplete.filter((t) => t.due_date && new Date(t.due_date) < now));
  const active = sortTodos(incomplete.filter((t) => !t.due_date || new Date(t.due_date) >= now));
  const completed = [...todos]
    .filter((t) => t.completed)
    .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime());
  return { overdue, active, completed };
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function RecurrenceBadge({ pattern }: { pattern: RecurrencePattern }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#6b21a8',
        background: '#f3e8ff',
        border: '1px solid #d8b4fe',
        borderRadius: '999px',
        padding: '0.1rem 0.6rem',
      }}
    >
      🔄 {pattern}
    </span>
  );
}

function RecurrenceFields({
  isRecurring,
  pattern,
  hasDueDate,
  onToggle,
  onPatternChange,
}: {
  isRecurring: boolean;
  pattern: RecurrencePattern;
  hasDueDate: boolean;
  onToggle: (checked: boolean) => void;
  onPatternChange: (pattern: RecurrencePattern) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', color: '#374151' }}>
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={!hasDueDate}
        />
        Repeat
      </label>
      {isRecurring ? (
        <select
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value as RecurrencePattern)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
        >
          {RECURRENCE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      ) : null}
      {!hasDueDate ? <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Set a due date to enable repeat</span> : null}
    </div>
  );
}

function ReminderBadge({ minutes }: { minutes: ReminderMinutes }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#9a3412',
        background: '#ffedd5',
        border: '1px solid #fdba74',
        borderRadius: '999px',
        padding: '0.1rem 0.6rem',
      }}
    >
      🔔 {REMINDER_LABELS[minutes]}
    </span>
  );
}

function ReminderSelect({
  value,
  hasDueDate,
  onChange,
}: {
  value: ReminderMinutes | null;
  hasDueDate: boolean;
  onChange: (minutes: ReminderMinutes | null) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', color: '#374151' }}>
        Reminder
        <select
          value={value ?? ''}
          disabled={!hasDueDate}
          onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as ReminderMinutes) : null)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
        >
          <option value="">None</option>
          {REMINDER_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {REMINDER_LABELS[minutes]} before
            </option>
          ))}
        </select>
      </label>
      {!hasDueDate ? <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Set a due date to enable reminders</span> : null}
    </div>
  );
}

function NotificationToggle() {
  const { permission, requestPermission } = useNotifications();
  const enabled = permission === 'granted';

  return (
    <button
      type="button"
      onClick={requestPermission}
      disabled={enabled}
      style={{
        padding: '0.6rem 1rem',
        borderRadius: '0.75rem',
        border: 'none',
        cursor: enabled ? 'default' : 'pointer',
        fontWeight: 600,
        background: enabled ? '#dcfce7' : '#f97316',
        color: enabled ? '#166534' : '#fff',
      }}
    >
      {enabled ? '🔔 Notifications On' : '🔔 Enable Notifications'}
    </button>
  );
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(null);
  const [error, setError] = useState('');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then((data: Todo[]) => setTodos(data))
      .finally(() => setIsLoading(false));
  }, []);

  const sections = useMemo(() => sectionTodos(todos, new Date()), [todos]);

  async function handleAddTodo() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || (isRecurring && !dueDate)) {
      return;
    }

    setError('');

    const payload = {
      title: trimmedTitle,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
    };

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create todo');
      }

      const saved: Todo = await res.json();
      setTodos((prev) => [...prev, saved]);
      setTitle('');
      setPriority('medium');
      setDueDate('');
      setIsRecurring(false);
      setRecurrencePattern('daily');
      setReminderMinutes(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create todo.');
    }
  }

  async function handleToggle(todo: Todo) {
    const nextCompleted = !todo.completed;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: nextCompleted ? 1 : 0 } as Todo : t)));

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update todo');
      const { nextInstance, ...updated } = (await res.json()) as Todo & { nextInstance?: Todo };
      setTodos((prev) => {
        const next = prev.map((t) => (t.id === updated.id ? (updated as Todo) : t));
        return nextInstance ? [...next, nextInstance] : next;
      });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      setError('Could not update todo. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    const previous = todos;
    setTodos((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete todo');
    } catch {
      setTodos(previous);
      setError('Could not delete todo. Please try again.');
    }
  }

  async function handleSaveEdit(updates: {
    title: string;
    priority: Priority;
    due_date: string | null;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: ReminderMinutes | null;
  }) {
    if (!editingTodo) return;

    try {
      const res = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to update todo');
      }
      const updated: Todo = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTodo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update todo.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <NotificationToggle />
      </div>
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0 }}>Add a todo</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            placeholder="Add a new todo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTodo();
            }}
            style={{ flex: '1 1 12rem', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => {
              const value = e.target.value;
              setDueDate(value);
              if (!value) {
                setIsRecurring(false);
                setReminderMinutes(null);
              }
            }}
            style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
          />
          <button
            type="button"
            onClick={handleAddTodo}
            disabled={!title.trim() || (isRecurring && !dueDate)}
            style={{ background: '#111827', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}
          >
            Add Todo
          </button>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <RecurrenceFields
            isRecurring={isRecurring}
            pattern={recurrencePattern}
            hasDueDate={Boolean(dueDate)}
            onToggle={setIsRecurring}
            onPatternChange={setRecurrencePattern}
          />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <ReminderSelect
            value={reminderMinutes}
            hasDueDate={Boolean(dueDate)}
            onChange={setReminderMinutes}
          />
        </div>
        {error ? <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p> : null}
      </div>

      {isLoading ? (
        <p>Loading todos...</p>
      ) : (
        <>
          <TodoSection title="Overdue" color="#b91c1c" todos={sections.overdue} onToggle={handleToggle} onEdit={setEditingTodo} onDelete={handleDelete} />
          <TodoSection title="Active" color="#374151" todos={sections.active} onToggle={handleToggle} onEdit={setEditingTodo} onDelete={handleDelete} />
          <TodoSection title="Completed" color="#065f46" todos={sections.completed} onToggle={handleToggle} onEdit={setEditingTodo} onDelete={handleDelete} />
        </>
      )}

      {editingTodo ? (
        <EditModal
          todo={editingTodo}
          onCancel={() => setEditingTodo(null)}
          onSave={handleSaveEdit}
        />
      ) : null}
    </div>
  );
}

function TodoSection({
  title,
  color,
  todos,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  color: string;
  todos: Todo[];
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0, color }}>
        {title} ({todos.length})
      </h3>
      {todos.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No todos here.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {todos.map((todo) => (
            <li key={todo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(todo.completed)}
                  onChange={() => onToggle(todo)}
                  aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.title}</p>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {todo.priority}
                    {todo.due_date ? ` · due ${formatDueDate(todo.due_date)}` : ''}
                    {todo.is_recurring && todo.recurrence_pattern ? <RecurrenceBadge pattern={todo.recurrence_pattern} /> : null}
                    {todo.reminder_minutes ? <ReminderBadge minutes={todo.reminder_minutes as ReminderMinutes} /> : null}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => onEdit(todo)} style={{ color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(todo.id)} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditModal({
  todo,
  onCancel,
  onSave,
}: {
  todo: Todo;
  onCancel: () => void;
  onSave: (updates: {
    title: string;
    priority: Priority;
    due_date: string | null;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: ReminderMinutes | null;
  }) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueDate, setDueDate] = useState(todo.due_date ? todo.due_date.slice(0, 16) : '');
  const [isRecurring, setIsRecurring] = useState(Boolean(todo.is_recurring));
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(todo.recurrence_pattern ?? 'daily');
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>((todo.reminder_minutes as ReminderMinutes) ?? null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}
      >
        <h3 style={{ marginTop: 0 }}>Edit todo</h3>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          type="text"
          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginBottom: '1rem' }}
        />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginBottom: '1rem' }}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Due date</label>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => {
            const value = e.target.value;
            setDueDate(value);
            if (!value) {
              setIsRecurring(false);
              setReminderMinutes(null);
            }
          }}
          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginBottom: '1rem' }}
        />
        <div style={{ marginBottom: '1rem' }}>
          <RecurrenceFields
            isRecurring={isRecurring}
            pattern={recurrencePattern}
            hasDueDate={Boolean(dueDate)}
            onToggle={setIsRecurring}
            onPatternChange={setRecurrencePattern}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <ReminderSelect
            value={reminderMinutes}
            hasDueDate={Boolean(dueDate)}
            onChange={setReminderMinutes}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                title: title.trim(),
                priority,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                is_recurring: isRecurring,
                recurrence_pattern: isRecurring ? recurrencePattern : null,
                reminder_minutes: dueDate ? reminderMinutes : null,
              })
            }
            disabled={!title.trim() || (isRecurring && !dueDate)}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
