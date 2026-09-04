import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { userDB } from '@/lib/db';

export type SessionUser = {
  userId: number;
  username: string;
};

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

export async function createSession(user: { id: number; username: string }) {
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  const store = await cookies();
  store.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get('session')?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    const user = userDB.findById(payload.userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, username: user.username };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const store = await cookies();
  store.set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
