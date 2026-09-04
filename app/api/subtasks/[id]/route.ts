import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, getDb } from '@/lib/db';

/** Verifies the subtask's parent todo belongs to the given user before any mutation. */
function findOwnedSubtask(userId: number, subtaskId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT subtasks.* FROM subtasks
       INNER JOIN todos ON todos.id = subtasks.todo_id
       WHERE subtasks.id = ? AND todos.user_id = ?`
    )
    .get(subtaskId, userId) as ReturnType<typeof subtaskDB.getById>;
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
  const existing = findOwnedSubtask(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    patch.title = title;
  }

  if (body.completed !== undefined) {
    patch.completed = body.completed ? 1 : 0;
  }

  if (body.position !== undefined) {
    patch.position = Number(body.position);
  }

  const updated = subtaskDB.update(Number(id), patch);
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
  const existing = findOwnedSubtask(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  subtaskDB.delete(Number(id));
  return NextResponse.json({ success: true });
}
