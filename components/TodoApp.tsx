'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Priority, RecurrencePattern, ReminderMinutes, Subtask, Tag, Template, Todo } from '@/lib/db';
import { applyFilters, DEFAULT_FILTER_STATE, isFilterActive, type FilterState } from '@/lib/filters';
import { calculateProgress, formatProgressLabel } from '@/lib/subtasks';
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
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER_STATE);

  const [subtasksByTodo, setSubtasksByTodo] = useState<Record<number, Subtask[]>>({});
  const [tagsByTodo, setTagsByTodo] = useState<Record<number, Tag[]>>({});
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSourceTodo, setTemplateSourceTodo] = useState<Todo | null>(null);

  async function loadChildData(todoList: Todo[]) {
    const subtaskEntries = await Promise.all(
      todoList.map(async (todo) => {
        const res = await fetch(`/api/todos/${todo.id}/subtasks`);
        const data: Subtask[] = res.ok ? await res.json() : [];
        return [todo.id, data] as const;
      })
    );
    const tagEntries = await Promise.all(
      todoList.map(async (todo) => {
        const res = await fetch(`/api/todos/${todo.id}/tags`);
        const data: Tag[] = res.ok ? await res.json() : [];
        return [todo.id, data] as const;
      })
    );
    setSubtasksByTodo(Object.fromEntries(subtaskEntries));
    setTagsByTodo(Object.fromEntries(tagEntries));
  }

  async function loadTags() {
    const res = await fetch('/api/tags');
    if (res.ok) setAllTags(await res.json());
  }

  async function loadTemplates() {
    const res = await fetch('/api/templates');
    if (res.ok) setTemplates(await res.json());
  }

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then(async (data: Todo[]) => {
        setTodos(data);
        await Promise.all([loadChildData(data), loadTags(), loadTemplates()]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredTodos = useMemo(() => applyFilters(todos, filter), [todos, filter]);
  const sections = useMemo(() => sectionTodos(filteredTodos, new Date()), [filteredTodos]);

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
      setSubtasksByTodo((prev) => ({ ...prev, [saved.id]: [] }));
      setTagsByTodo((prev) => ({ ...prev, [saved.id]: [] }));
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

  async function handleAddSubtask(todoId: number, subtaskTitle: string) {
    const trimmed = subtaskTitle.trim();
    if (!trimmed) return;

    const res = await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) {
      setError('Could not add subtask.');
      return;
    }
    const created: Subtask = await res.json();
    setSubtasksByTodo((prev) => ({ ...prev, [todoId]: [...(prev[todoId] ?? []), created] }));
  }

  async function handleToggleSubtask(todoId: number, subtask: Subtask) {
    const nextCompleted = subtask.completed ? 0 : 1;
    setSubtasksByTodo((prev) => ({
      ...prev,
      [todoId]: (prev[todoId] ?? []).map((s) => (s.id === subtask.id ? { ...s, completed: nextCompleted } : s)),
    }));

    const res = await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: Boolean(nextCompleted) }),
    });
    if (!res.ok) {
      setSubtasksByTodo((prev) => ({
        ...prev,
        [todoId]: (prev[todoId] ?? []).map((s) => (s.id === subtask.id ? subtask : s)),
      }));
      setError('Could not update subtask.');
    }
  }

  async function handleDeleteSubtask(todoId: number, subtaskId: number) {
    const previous = subtasksByTodo[todoId] ?? [];
    setSubtasksByTodo((prev) => ({ ...prev, [todoId]: previous.filter((s) => s.id !== subtaskId) }));

    const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    if (!res.ok) {
      setSubtasksByTodo((prev) => ({ ...prev, [todoId]: previous }));
      setError('Could not delete subtask.');
    }
  }

  async function handleCreateTag(name: string, color: string) {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not create tag.');
      return;
    }
    const created: Tag = await res.json();
    setAllTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteTag(tagId: number) {
    const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Could not delete tag.');
      return;
    }
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));
    setTagsByTodo((prev) => {
      const next: Record<number, Tag[]> = {};
      for (const [todoId, tags] of Object.entries(prev)) {
        next[Number(todoId)] = tags.filter((t) => t.id !== tagId);
      }
      return next;
    });
  }

  async function handleAssignTag(todoId: number, tagId: number) {
    const res = await fetch(`/api/todos/${todoId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });
    if (!res.ok) {
      setError('Could not assign tag.');
      return;
    }
    const updatedTags: Tag[] = await res.json();
    setTagsByTodo((prev) => ({ ...prev, [todoId]: updatedTags }));
  }

  async function handleRemoveTag(todoId: number, tagId: number) {
    const res = await fetch(`/api/todos/${todoId}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });
    if (!res.ok) {
      setError('Could not remove tag.');
      return;
    }
    const updatedTags: Tag[] = await res.json();
    setTagsByTodo((prev) => ({ ...prev, [todoId]: updatedTags }));
  }

  async function handleSaveTemplate(sourceTodo: Todo, offsetDays: number) {
    const subtasks = subtasksByTodo[sourceTodo.id] ?? [];
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: sourceTodo.title,
        priority: sourceTodo.priority,
        offset_days: offsetDays,
        subtasks: subtasks.map((s) => ({ title: s.title })),
      }),
    });
    if (!res.ok) {
      setError('Could not save template.');
      return;
    }
    const created: Template = await res.json();
    setTemplates((prev) => [created, ...prev]);
    setTemplateSourceTodo(null);
  }

  async function handleUseTemplate(template: Template) {
    const res = await fetch(`/api/templates/${template.id}/use`, { method: 'POST' });
    if (!res.ok) {
      setError('Could not create todo from template.');
      return;
    }
    const { todo: newTodo, subtasks }: { todo: Todo; subtasks: Subtask[] } = await res.json();
    setTodos((prev) => [...prev, newTodo]);
    setSubtasksByTodo((prev) => ({ ...prev, [newTodo.id]: subtasks }));
    setTagsByTodo((prev) => ({ ...prev, [newTodo.id]: [] }));
  }

  async function handleDeleteTemplate(templateId: number) {
    const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Could not delete template.');
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
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

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setIsTagModalOpen(true)}
          style={{ background: '#fff', color: '#111827', padding: '0.6rem 1rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', cursor: 'pointer' }}
        >
          Manage Tags
        </button>
        <button
          type="button"
          onClick={() => setIsTemplateModalOpen(true)}
          style={{ background: '#fff', color: '#111827', padding: '0.6rem 1rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', cursor: 'pointer' }}
        >
          Templates
        </button>
      </div>

      <FilterBar filter={filter} onChange={setFilter} />

      {isLoading ? (
        <p>Loading todos...</p>
      ) : (
        <>
          <TodoSection
            title="Overdue"
            color="#b91c1c"
            todos={sections.overdue}
            onToggle={handleToggle}
            onEdit={setEditingTodo}
            onDelete={handleDelete}
            subtasksByTodo={subtasksByTodo}
            tagsByTodo={tagsByTodo}
            allTags={allTags}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onAssignTag={handleAssignTag}
            onRemoveTag={handleRemoveTag}
            onSaveAsTemplate={setTemplateSourceTodo}
          />
          <TodoSection
            title="Active"
            color="#374151"
            todos={sections.active}
            onToggle={handleToggle}
            onEdit={setEditingTodo}
            onDelete={handleDelete}
            subtasksByTodo={subtasksByTodo}
            tagsByTodo={tagsByTodo}
            allTags={allTags}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onAssignTag={handleAssignTag}
            onRemoveTag={handleRemoveTag}
            onSaveAsTemplate={setTemplateSourceTodo}
          />
          <TodoSection
            title="Completed"
            color="#065f46"
            todos={sections.completed}
            onToggle={handleToggle}
            onEdit={setEditingTodo}
            onDelete={handleDelete}
            subtasksByTodo={subtasksByTodo}
            tagsByTodo={tagsByTodo}
            allTags={allTags}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onAssignTag={handleAssignTag}
            onRemoveTag={handleRemoveTag}
            onSaveAsTemplate={setTemplateSourceTodo}
          />
        </>
      )}

      {editingTodo ? (
        <EditModal
          todo={editingTodo}
          onCancel={() => setEditingTodo(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      {isTagModalOpen ? (
        <TagModal
          tags={allTags}
          onClose={() => setIsTagModalOpen(false)}
          onCreate={handleCreateTag}
          onDelete={handleDeleteTag}
        />
      ) : null}

      {isTemplateModalOpen ? (
        <TemplateModal
          templates={templates}
          onClose={() => setIsTemplateModalOpen(false)}
          onUse={handleUseTemplate}
          onDelete={handleDeleteTemplate}
        />
      ) : null}

      {templateSourceTodo ? (
        <SaveTemplateModal
          todo={templateSourceTodo}
          onCancel={() => setTemplateSourceTodo(null)}
          onSave={(offsetDays) => handleSaveTemplate(templateSourceTodo, offsetDays)}
        />
      ) : null}
    </div>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}) {
  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '999px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.85rem',
  };
  const chipButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#3730a3',
    cursor: 'pointer',
    fontWeight: 700,
    padding: 0,
  };

  return (
    <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search todos"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          style={{ flex: '1 1 12rem', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>Priority</span>
          <select
            aria-label="Filter by priority"
            value={filter.priority}
            onChange={(e) => onChange({ ...filter, priority: e.target.value as FilterState['priority'] })}
            style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>Status</span>
          <select
            aria-label="Filter by status"
            value={filter.status}
            onChange={(e) => onChange({ ...filter, status: e.target.value as FilterState['status'] })}
            style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db' }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {isFilterActive(filter) ? (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTER_STATE)}
            style={{ background: '#111827', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      {isFilterActive(filter) ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {filter.query.trim() ? (
            <span style={chipStyle}>
              Text: {filter.query}
              <button type="button" style={chipButtonStyle} onClick={() => onChange({ ...filter, query: '' })} aria-label="Clear text filter">
                ×
              </button>
            </span>
          ) : null}
          {filter.priority !== 'all' ? (
            <span style={chipStyle}>
              Priority: {filter.priority}
              <button type="button" style={chipButtonStyle} onClick={() => onChange({ ...filter, priority: 'all' })} aria-label="Clear priority filter">
                Clear priority ×
              </button>
            </span>
          ) : null}
          {filter.status !== 'all' ? (
            <span style={chipStyle}>
              Status: {filter.status}
              <button type="button" style={chipButtonStyle} onClick={() => onChange({ ...filter, status: 'all' })} aria-label="Clear status filter">
                Clear status ×
              </button>
            </span>
          ) : null}
        </div>
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
  subtasksByTodo,
  tagsByTodo,
  allTags,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAssignTag,
  onRemoveTag,
  onSaveAsTemplate,
}: {
  title: string;
  color: string;
  todos: Todo[];
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  subtasksByTodo: Record<number, Subtask[]>;
  tagsByTodo: Record<number, Tag[]>;
  allTags: Tag[];
  onAddSubtask: (todoId: number, title: string) => void;
  onToggleSubtask: (todoId: number, subtask: Subtask) => void;
  onDeleteSubtask: (todoId: number, subtaskId: number) => void;
  onAssignTag: (todoId: number, tagId: number) => void;
  onRemoveTag: (todoId: number, tagId: number) => void;
  onSaveAsTemplate: (todo: Todo) => void;
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
            <li key={todo.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
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
                  <button type="button" onClick={() => onSaveAsTemplate(todo)} style={{ color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Save as Template
                  </button>
                  <button type="button" onClick={() => onEdit(todo)} style={{ color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDelete(todo.id)} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>

              <TodoTags
                todo={todo}
                assignedTags={tagsByTodo[todo.id] ?? []}
                allTags={allTags}
                onAssignTag={onAssignTag}
                onRemoveTag={onRemoveTag}
              />

              <TodoSubtasks
                todo={todo}
                subtasks={subtasksByTodo[todo.id] ?? []}
                onAdd={onAddSubtask}
                onToggle={onToggleSubtask}
                onDelete={onDeleteSubtask}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoTags({
  todo,
  assignedTags,
  allTags,
  onAssignTag,
  onRemoveTag,
}: {
  todo: Todo;
  assignedTags: Tag[];
  allTags: Tag[];
  onAssignTag: (todoId: number, tagId: number) => void;
  onRemoveTag: (todoId: number, tagId: number) => void;
}) {
  const unassignedTags = allTags.filter((tag) => !assignedTags.some((a) => a.id === tag.id));

  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', paddingLeft: '1.9rem' }}>
      {assignedTags.map((tag) => (
        <span
          key={tag.id}
          className="tag"
          style={{ background: tag.color, color: '#fff', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <span>{tag.name}</span>
          <button
            type="button"
            onClick={() => onRemoveTag(todo.id, tag.id)}
            aria-label={`Remove tag ${tag.name} from ${todo.title}`}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, padding: 0 }}
          >
            ×
          </button>
        </span>
      ))}
      {unassignedTags.length > 0 ? (
        <select
          aria-label={`Assign tag to ${todo.title}`}
          value=""
          onChange={(e) => {
            if (e.target.value) onAssignTag(todo.id, Number(e.target.value));
          }}
          style={{ fontSize: '0.75rem', borderRadius: '999px', border: '1px solid #d1d5db', padding: '0.15rem 0.5rem' }}
        >
          <option value="">+ Add tag</option>
          {unassignedTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function TodoSubtasks({
  todo,
  subtasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  subtasks: Subtask[];
  onAdd: (todoId: number, title: string) => void;
  onToggle: (todoId: number, subtask: Subtask) => void;
  onDelete: (todoId: number, subtaskId: number) => void;
}) {
  const [newSubtask, setNewSubtask] = useState('');
  const progress = calculateProgress(subtasks);

  return (
    <div style={{ paddingLeft: '1.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {subtasks.length > 0 ? (
        <>
          <div style={{ height: '0.4rem', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress.percent}%`, background: '#10b981' }} />
          </div>
          <span style={{ fontSize: '0.8rem', color: '#4b5563' }}>{formatProgressLabel(progress)}</span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {subtasks.map((subtask) => (
              <li key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(subtask.completed)}
                  onChange={() => onToggle(todo.id, subtask)}
                  aria-label={`Mark subtask "${subtask.title}" as ${subtask.completed ? 'incomplete' : 'complete'}`}
                />
                <span style={{ fontSize: '0.85rem', textDecoration: subtask.completed ? 'line-through' : 'none' }}>{subtask.title}</span>
                <button
                  type="button"
                  onClick={() => onDelete(todo.id, subtask.id)}
                  aria-label={`Delete subtask ${subtask.title}`}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input
          placeholder="Add subtask"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newSubtask.trim()) {
              onAdd(todo.id, newSubtask);
              setNewSubtask('');
            }
          }}
          style={{ flex: '1 1 auto', fontSize: '0.85rem', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
        />
        <button
          type="button"
          onClick={() => {
            if (newSubtask.trim()) {
              onAdd(todo.id, newSubtask);
              setNewSubtask('');
            }
          }}
          disabled={!newSubtask.trim()}
          style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', borderRadius: '0.5rem', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}
        >
          Add subtask
        </button>
      </div>
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

function TagModal({
  tags,
  onClose,
  onCreate,
  onDelete,
}: {
  tags: Tag[];
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  onDelete: (tagId: number) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
        <h3 style={{ marginTop: 0 }}>Manage Tags</h3>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            placeholder="Tag name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: '1 1 auto', padding: '0.5rem 0.7rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: '2.5rem', padding: 0, border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
          />
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onCreate(name, color);
                setName('');
              }
            }}
            disabled={!name.trim()}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}
          >
            Create Tag
          </button>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '16rem', overflowY: 'auto' }}>
          {tags.map((tag) => (
            <li key={tag.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '0.9rem', height: '0.9rem', borderRadius: '50%', background: tag.color, display: 'inline-block' }} />
                {tag.name}
              </span>
              <button type="button" onClick={() => onDelete(tag.id)} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                Delete
              </button>
            </li>
          ))}
          {tags.length === 0 ? <p style={{ color: '#9ca3af' }}>No tags yet.</p> : null}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({
  templates,
  onClose,
  onUse,
  onDelete,
}: {
  templates: Template[];
  onClose: () => void;
  onUse: (template: Template) => void;
  onDelete: (templateId: number) => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
        <h3 style={{ marginTop: 0 }}>Templates</h3>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '20rem', overflowY: 'auto' }}>
          {templates.map((template) => (
            <li key={template.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.6rem 0.8rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{template.title}</p>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {template.priority} · due in {template.offset_days}d
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => onUse(template)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}
                >
                  Use Template
                </button>
                <button type="button" onClick={() => onDelete(template.id)} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </li>
          ))}
          {templates.length === 0 ? <p style={{ color: '#9ca3af' }}>No templates yet. Save one from a todo.</p> : null}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveTemplateModal({
  todo,
  onCancel,
  onSave,
}: {
  todo: Todo;
  onCancel: () => void;
  onSave: (offsetDays: number) => void;
}) {
  const [offsetDays, setOffsetDays] = useState(0);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '24rem' }}>
        <h3 style={{ marginTop: 0 }}>Save &quot;{todo.title}&quot; as Template</h3>
        <label htmlFor="template-offset-days" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Due date offset (days from use)</label>
        <input
          id="template-offset-days"
          type="number"
          value={offsetDays}
          onChange={(e) => setOffsetDays(Number(e.target.value))}
          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginBottom: '1.5rem' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(offsetDays)}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
