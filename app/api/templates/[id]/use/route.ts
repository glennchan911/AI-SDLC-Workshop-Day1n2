import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, todoDB, subtaskDB } from '@/lib/db';
import { deserializeSubtasks, computeDueDate } from '@/lib/templates';

/** Creates a new todo (plus its subtasks) from a saved template. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const template = templateDB.getById(session.userId, Number(id));
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const dueDate = template.offset_days ? computeDueDate(template.offset_days) : null;

  const newTodo = todoDB.create(session.userId, {
    title: template.title,
    priority: template.priority,
    due_date: dueDate,
  });

  if (!newTodo) {
    return NextResponse.json({ error: 'Failed to create todo from template' }, { status: 500 });
  }

  const subtasks = deserializeSubtasks(template.subtasks_json);
  for (const subtask of subtasks) {
    subtaskDB.create(newTodo.id, subtask.title);
  }

  return NextResponse.json(
    { todo: newTodo, subtasks: subtaskDB.listByTodo(newTodo.id) },
    { status: 201 }
  );
}
