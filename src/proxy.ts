import { NextResponse, type NextRequest } from 'next/server';

// Auth.js v5 session cookie names (the __Secure- prefix is used over https).
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

/**
 * Optimistic check only: no session cookie means a fast redirect to sign-in. The real check
 * (signature, expiry, sessionVersion) runs in the page through requireUser().
 */
export default function proxy(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    const url = new URL('/sign-in', req.nextUrl);
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
