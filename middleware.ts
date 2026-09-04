import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isPublicPath = pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api/auth') || pathname === '/favicon.ico';

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!sessionCookie && (pathname === '/' || pathname === '/calendar')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar'],
};
