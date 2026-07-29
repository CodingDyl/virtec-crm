import 'server-only';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, STORAGE_BUCKET } from '@/lib/firebase-admin';

/**
 * Server-issued access to Cloud Storage.
 *
 * Storage rules deny the browser entirely, so nothing uploads or downloads
 * directly any more. Instead the server signs a short-lived URL for one
 * specific object and hands that back. File bytes still travel straight
 * between the browser and Google — they never pass through this server, which
 * keeps large receipts and PDFs clear of serverless request-body limits.
 */

/** Long enough to open or finish an upload, short enough that a leaked link dies quickly. */
const READ_TTL_MS = 15 * 60 * 1000;
const UPLOAD_TTL_MS = 10 * 60 * 1000;

/** Hard ceiling mirrored on the client; the signed URL is scoped to one object regardless. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED_PREFIXES = ['documents/', 'receipts/', 'design/', 'quotes/', 'invoices/', 'agreements/'];

function bucket() {
  return getStorage(getAdminApp()).bucket(STORAGE_BUCKET);
}

/**
 * Reject anything that escapes the known prefixes. Callers supply the path, so
 * this is the boundary that stops a signed URL being minted for, say, another
 * tenant's folder or a traversal outside the tree.
 */
export function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 512) return false;
  if (path.includes('..') || path.startsWith('/')) return false;
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** A legacy value is a full download URL rather than a bucket path. */
export function isLegacyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/** Build a unique, prefix-scoped path for a new upload. */
export function buildStoragePath(prefix: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `${cleanPrefix}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;
}

/** A URL the browser can PUT one file to, for a limited time. */
export async function signedUploadUrl(
  path: string,
  contentType: string
): Promise<{ url: string; path: string }> {
  const [url] = await bucket()
    .file(path)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + UPLOAD_TTL_MS,
      contentType,
    });

  return { url, path };
}

/**
 * A URL the browser can GET one file from, for a limited time.
 *
 * Records created before this change stored a permanent download URL and no
 * path. Those are returned untouched — they carry their own access token and
 * are not affected by storage rules.
 */
export async function signedReadUrl(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (isLegacyUrl(pathOrUrl)) return pathOrUrl;
  if (!isSafeStoragePath(pathOrUrl)) return null;

  try {
    const [url] = await bucket()
      .file(pathOrUrl)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + READ_TTL_MS,
      });
    return url;
  } catch (error) {
    console.error('signedReadUrl failed for', pathOrUrl, error);
    return null;
  }
}

/** Remove an object. A missing file is not an error worth surfacing. */
export async function deleteStoredObject(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl || isLegacyUrl(pathOrUrl)) {
    // Legacy download URLs have no reliable path to delete by; the Firestore
    // record goes away regardless and the object is unreachable without it.
    return;
  }
  if (!isSafeStoragePath(pathOrUrl)) return;

  try {
    await bucket().file(pathOrUrl).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error('deleteStoredObject failed for', pathOrUrl, error);
  }
}
