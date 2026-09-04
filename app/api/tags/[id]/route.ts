import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';
import { normalizeTagName, isValidHexColor } from '@/lib/tags';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const existing = tagDB.findByUserAndId(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = normalizeTagName(String(body.name));
    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    const duplicate = tagDB
      .list(session.userId)
      .find((tag) => tag.id !== existing.id && tag.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }
    patch.name = name;
  }

  if (body.color !== undefined) {
    const color = String(body.color);
    if (!isValidHexColor(color)) {
      return NextResponse.json({ error: 'Color must be a valid hex code, e.g. #6b7280' }, { status: 400 });
    }
    patch.color = color;
  }

  const updated = tagDB.update(existing.id, patch);
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
  const existing = tagDB.findByUserAndId(session.userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  // ON DELETE CASCADE on todo_tags.tag_id removes join rows automatically.
  tagDB.delete(existing.id);
  return NextResponse.json({ success: true });
}
