import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, type Priority } from '@/lib/db';
import { serializeSubtasks } from '@/lib/templates';

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const existing = templateDB.getById(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
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

  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: `priority must be one of ${VALID_PRIORITIES.join(', ')}` }, { status: 400 });
    }
    patch.priority = body.priority;
  }

  if (body.offset_days !== undefined) {
    const offsetDays = Number(body.offset_days);
    if (!Number.isFinite(offsetDays)) {
      return NextResponse.json({ error: 'offset_days must be a number' }, { status: 400 });
    }
    patch.offset_days = offsetDays;
  }

  if (body.subtasks !== undefined) {
    if (!Array.isArray(body.subtasks)) {
      return NextResponse.json({ error: 'subtasks must be an array' }, { status: 400 });
    }
    patch.subtasks_json = serializeSubtasks(body.subtasks);
  }

  const updated = templateDB.update(session.userId, Number(id), patch);
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
  const existing = templateDB.getById(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  templateDB.delete(session.userId, Number(id));
  return NextResponse.json({ success: true });
}
