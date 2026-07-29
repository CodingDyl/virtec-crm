import 'server-only';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';

/**
 * Server-side session verification.
 *
 * The client SDK keeps its session in IndexedDB, which the server cannot see.
 * On sign-in the browser exchanges its ID token for a Firebase session cookie
 * here, so route handlers and server components can establish who is calling
 * before rendering or mutating anything.
 */

/**
 * Firebase Hosting forwards exactly one cookie to a dynamic backend, and it
 * must be named `__session`. Nothing else survives that path, so the name is
 * fixed even though this deploys to Vercel today.
 */
export const SESSION_COOKIE = '__session';

/** Five days. Firebase permits up to fourteen. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface Operator {
  uid: string;
  email: string | null;
}

/** Mint a session cookie from a freshly issued ID token. */
export async function createSessionCookie(idToken: string): Promise<string> {
  return getAuth(getAdminApp()).createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

/** True when this uid is on the operator allowlist. */
export async function isOperator(uid: string): Promise<boolean> {
  const snap = await getAdminDb().collection('operators').doc(uid).get();
  return snap.exists;
}

/**
 * Resolve the caller from their session cookie, or null.
 *
 * Verification is done with `checkRevoked`, so signing out (which revokes
 * refresh tokens) invalidates the cookie everywhere rather than leaving it
 * valid until it expires. Allowlist membership is re-checked on every call,
 * so removing an operator takes effect immediately.
 */
export async function getOperator(): Promise<Operator | null> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const claims = await getAuth(getAdminApp()).verifySessionCookie(session, true);
    if (!(await isOperator(claims.uid))) return null;
    return { uid: claims.uid, email: claims.email ?? null };
  } catch {
    // Expired, revoked, malformed, or signed for another project.
    return null;
  }
}

/** Verify an ID token and confirm the holder is an operator. */
export async function verifyIdTokenAsOperator(idToken: string): Promise<Operator | null> {
  try {
    const claims = await getAuth(getAdminApp()).verifyIdToken(idToken, true);
    if (!(await isOperator(claims.uid))) return null;
    return { uid: claims.uid, email: claims.email ?? null };
  } catch {
    return null;
  }
}

/** Revoke every session for a uid, so the cookie cannot outlive a sign-out. */
export async function revokeSessions(uid: string): Promise<void> {
  await getAuth(getAdminApp()).revokeRefreshTokens(uid);
}
