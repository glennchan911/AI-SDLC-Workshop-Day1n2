import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';
import { calculateNextDueDate } from '@/lib/recurrence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.getTodoById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(todo);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Fetch the current row only after every `await` above has resolved. From
  // this point on the function is fully synchronous (better-sqlite3 calls
  // block the single JS thread), so no concurrent request can observe or
  // act on a stale `completed` value between this read and the write below —
  // closing the race window a double-submit completion request would need.
  const existing = todoDB.getTodoById(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = { ...body };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    patch.title = title;
  }

  if (body.due_date) {
    const due = new Date(body.due_date);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
    const minDue = new Date(getSingaporeNow().getTime() + 60_000);
    if (due < minDue) {
      return NextResponse.json(
        { error: 'Due date must be at least 1 minute in the future' },
        { status: 400 }
      );
    }
  }

  // Recurrence fields may be partially updated; validate against the
  // effective (post-patch) state, not just the fields present on this request.
  const effectiveIsRecurring = body.is_recurring !== undefined ? Boolean(body.is_recurring) : Boolean(existing.is_recurring);
  const effectiveDueDate = body.due_date !== undefined ? body.due_date : existing.due_date;
  const effectivePattern = body.recurrence_pattern !== undefined ? body.recurrence_pattern : existing.recurrence_pattern;

  if (effectiveIsRecurring) {
    if (!effectiveDueDate) {
      return NextResponse.json(
        { error: 'Recurring todos require a due date' },
        { status: 400 }
      );
    }
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(effectivePattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  if (body.is_recurring !== undefined) {
    patch.is_recurring = body.is_recurring ? 1 : 0;
  }

  // Only spawn a next instance on the false -> true completion transition, so a
  // second PUT on an already-completed todo (double-submit) is a no-op here.
  const justCompleted = body.completed === true && existing.completed === 0;

  if (body.completed !== undefined) {
    patch.completed = body.completed ? 1 : 0;
  }

  const updated = todoDB.updateTodo(session.userId, Number(id), patch);
  if (!updated) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  if (justCompleted && updated.is_recurring && updated.recurrence_pattern && updated.due_date) {
    const nextDueDate = calculateNextDueDate(updated.due_date, updated.recurrence_pattern);

    const nextInstance = todoDB.createTodo(session.userId, {
      title: updated.title,
      priority: updated.priority,
      is_recurring: 1,
      recurrence_pattern: updated.recurrence_pattern,
      reminder_minutes: updated.reminder_minutes ?? null,
      due_date: nextDueDate,
    });

    return NextResponse.json({ ...updated, nextInstance });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const existing = todoDB.getTodoById(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  todoDB.deleteTodo(session.userId, Number(id));
  return NextResponse.json({ success: true });
}
