/**
 * Browser-side storage access.
 *
 * Storage rules deny the browser, so nothing here talks to Cloud Storage
 * directly. Every operation asks /api/storage — which verifies the operator
 * session — for a short-lived signed URL, then uses it. Upload bytes go
 * straight to Google, never through the app server.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type StoragePrefix =
  | 'documents'
  | 'receipts'
  | 'design'
  | 'quotes'
  | 'invoices'
  | 'agreements';

async function storageRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/storage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }));
    throw new Error(error ?? 'Storage request failed.');
  }

  return response.json();
}

/**
 * Upload a file and return its bucket path. Callers store the path — not a
 * URL — so access is always brokered and can be revoked by changing rules.
 */
export async function uploadFile(
  file: File | Blob,
  prefix: StoragePrefix,
  fileName?: string
): Promise<string> {
  const name = fileName ?? (file instanceof File ? file.name : 'file');
  const contentType = file.type || 'application/octet-stream';

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Files must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  const { url, path } = await storageRequest<{ url: string; path: string }>({
    action: 'upload',
    prefix,
    fileName: name,
    contentType,
    size: file.size,
  });

  // The signed URL is bound to this exact content type; a mismatch is rejected.
  const upload = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!upload.ok) {
    throw new Error('Upload failed. Please try again.');
  }

  return path;
}

/** A short-lived URL for viewing a stored file. Legacy URLs pass straight through. */
export async function getFileUrl(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const { url } = await storageRequest<{ url: string }>({ action: 'read', path: pathOrUrl });
  return url;
}

/**
 * Open a stored file in a new tab.
 *
 * The tab is opened synchronously and its location set once the signed URL
 * arrives — opening it after the await would be blocked as a popup, since the
 * call would no longer be inside the click handler's user gesture.
 */
export async function openStoredFile(pathOrUrl: string): Promise<void> {
  const tab = window.open('', '_blank', 'noopener,noreferrer');
  try {
    const url = await getFileUrl(pathOrUrl);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Remove stored objects. Safe to call with legacy URLs or an empty list. */
export async function deleteFiles(paths: (string | null | undefined)[]): Promise<void> {
  const real = paths.filter((p): p is string => Boolean(p) && !p!.startsWith('http'));
  if (real.length === 0) return;
  await storageRequest({ action: 'delete', paths: real });
}
