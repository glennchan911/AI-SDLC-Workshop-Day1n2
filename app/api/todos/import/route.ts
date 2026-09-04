import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, todoDB, type Priority, type RecurrencePattern } from '@/lib/db';

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const VALID_RECURRENCE: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface ImportTodoInput {
  title?: unknown;
  completed?: unknown;
  due_date?: unknown;
  priority?: unknown;
  is_recurring?: unknown;
  recurrence_pattern?: unknown;
  reminder_minutes?: unknown;
}

interface ValidatedTodo {
  title: string;
  completed: 0 | 1;
  due_date: string | null;
  priority: Priority;
  is_recurring: 0 | 1;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
}

function validateTodo(raw: ImportTodoInput, index: number): { value?: ValidatedTodo; error?: string } {
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    return { error: `todos[${index}].title must be a non-empty string` };
  }

  if (raw.priority !== undefined && !VALID_PRIORITIES.includes(raw.priority as Priority)) {
    return { error: `todos[${index}].priority must be one of ${VALID_PRIORITIES.join(', ')}` };
  }

  if (raw.due_date !== undefined && raw.due_date !== null) {
    if (typeof raw.due_date !== 'string' || Number.isNaN(new Date(raw.due_date).getTime())) {
      return { error: `todos[${index}].due_date must be a valid ISO date string or null` };
    }
  }

  if (
    raw.recurrence_pattern !== undefined &&
    raw.recurrence_pattern !== null &&
    !VALID_RECURRENCE.includes(raw.recurrence_pattern as RecurrencePattern)
  ) {
    return { error: `todos[${index}].recurrence_pattern must be one of ${VALID_RECURRENCE.join(', ')} or null` };
  }

  if (
    raw.reminder_minutes !== undefined &&
    raw.reminder_minutes !== null &&
    typeof raw.reminder_minutes !== 'number'
  ) {
    return { error: `todos[${index}].reminder_minutes must be a number or null` };
  }

  return {
    value: {
      title: raw.title.trim(),
      completed: raw.completed ? 1 : 0,
      due_date: (raw.due_date as string | null) ?? null,
      priority: (raw.priority as Priority) ?? 'medium',
      is_recurring: raw.is_recurring ? 1 : 0,
      recurrence_pattern: (raw.recurrence_pattern as RecurrencePattern | null) ?? null,
      reminder_minutes: (raw.reminder_minutes as number | null) ?? null,
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const todosInput = (body as { todos?: unknown })?.todos;
  if (!Array.isArray(todosInput)) {
    return NextResponse.json({ error: 'Payload must include a "todos" array' }, { status: 400 });
  }

  const validated: ValidatedTodo[] = [];
  for (let i = 0; i < todosInput.length; i += 1) {
    const { value, error } = validateTodo(todosInput[i] as ImportTodoInput, i);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    validated.push(value as ValidatedTodo);
  }

  // Ignore any incoming id/user_id fields: always assign new ids and force the
  // current session's user, so imported records never collide with or leak
  // into another user's data.
  const db = getDb();
  const importAll = db.transaction((items: ValidatedTodo[]) => {
    let count = 0;
    for (const item of items) {
      todoDB.create(session.userId, item);
      count += 1;
    }
    return count;
  });

  const imported = importAll(validated);

  return NextResponse.json({ imported }, { status: 201 });
}
