import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  getOperator,
  revokeSessions,
  verifyIdTokenAsOperator,
} from '@/lib/auth-server';
import { AdminNotConfiguredError, isAdminConfigured } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Exchange a Firebase ID token for a session cookie.
 *
 * The token is verified against the operator allowlist before any cookie is
 * issued, so an account that merely signed itself up against the public config
 * never receives one.
 */
export async function POST(request: NextRequest) {
  let idToken: string | undefined;

  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // Checked up front: token verification swallows its own errors and would
  // otherwise report a misconfigured server as "not authorised", sending the
  // operator hunting for a permissions problem that does not exist.
  if (!isAdminConfigured()) {
    console.error('Sign-in attempted without Admin credentials configured.');
    return NextResponse.json(
      {
        code: 'admin-not-configured',
        error: 'Sign-in is unavailable: the server is missing its credentials.',
      },
      { status: 503 }
    );
  }

  try {
    const operator = await verifyIdTokenAsOperator(idToken);
    if (!operator) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
    }

    const cookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, cookie, {
      ...cookieOptions,
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return response;
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      console.error('Sign-in attempted without Admin credentials configured.');
      return NextResponse.json(
        {
          code: 'admin-not-configured',
          error: 'Sign-in is unavailable: the server is missing its credentials.',
        },
        { status: 503 }
      );
    }
    console.error('session creation failed:', error);
    return NextResponse.json({ error: 'Could not start a session.' }, { status: 500 });
  }
}

/** Sign out: clear the cookie and revoke every session for the account. */
export async function DELETE() {
  try {
    const operator = await getOperator();
    if (operator) await revokeSessions(operator.uid);
  } catch (error) {
    // Clearing the cookie matters more than revocation succeeding.
    console.error('session revocation failed:', error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
