import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, type Priority } from '@/lib/db';
import { serializeSubtasks } from '@/lib/templates';

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(templateDB.list(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const priority = (body.priority ?? 'medium') as Priority;
  if (!VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: `priority must be one of ${VALID_PRIORITIES.join(', ')}` }, { status: 400 });
  }

  const offsetDays = Number(body.offset_days ?? 0);
  if (!Number.isFinite(offsetDays)) {
    return NextResponse.json({ error: 'offset_days must be a number' }, { status: 400 });
  }

  const subtasks = Array.isArray(body.subtasks) ? body.subtasks : [];
  if (subtasks.some((s: unknown) => typeof (s as { title?: unknown })?.title !== 'string')) {
    return NextResponse.json({ error: 'Each subtask must have a string title' }, { status: 400 });
  }

  const template = templateDB.create(session.userId, {
    title,
    priority,
    offset_days: offsetDays,
    subtasks_json: serializeSubtasks(subtasks),
  });

  return NextResponse.json(template, { status: 201 });
}
