import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST() {
  await deleteSession();
  return NextResponse.redirect(new URL('/login', 'http://localhost:3000'));
}
