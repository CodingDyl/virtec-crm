/**
 * Kept separate from lib/portal so the workspace can mint a token without
 * pulling the whole server-side portal module into the client bundle.
 */

/** URL-safe, unguessable, and short enough to paste into an email. */
export function generatePortalToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
