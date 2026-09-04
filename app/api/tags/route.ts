import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';
import { normalizeTagName, isValidHexColor } from '@/lib/tags';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(tagDB.list(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const name = normalizeTagName(String(body.name ?? ''));
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const color = String(body.color ?? '#6b7280');
  if (!isValidHexColor(color)) {
    return NextResponse.json({ error: 'Color must be a valid hex code, e.g. #6b7280' }, { status: 400 });
  }

  const existing = tagDB.list(session.userId).find((tag) => tag.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
  }

  const tag = tagDB.create(session.userId, name, color);
  return NextResponse.json(tag, { status: 201 });
}
