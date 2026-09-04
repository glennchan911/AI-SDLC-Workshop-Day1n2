import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

/**
 * Exports the authenticated user's todos as a versioned JSON payload.
 * The payload only includes fields already present on the `todos` table
 * (tags/subtasks are out of scope until plan 04 lands).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.getTodosByUser(session.userId);

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    todos,
  });
}
