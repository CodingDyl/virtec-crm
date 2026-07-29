import { NextRequest, NextResponse } from 'next/server';

/**
 * A cheap first gate on the protected routes.
 *
 * Middleware runs on the Edge runtime, where the Admin SDK cannot run, so this
 * can only check that a session cookie is *present* — it cannot verify the
 * signature or the allowlist. Real verification happens in the server layout
 * (lib/auth-server), which refuses to render the CRM without it. This exists
 * to turn the common signed-out case into a redirect before any work is done.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('__session');
  if (hasSession) return NextResponse.next();

  const signIn = new URL('/', request.url);
  // Remember where they were headed so sign-in can return them there.
  signIn.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ['/dashboard/:path*', '/passwords/:path*'],
};
