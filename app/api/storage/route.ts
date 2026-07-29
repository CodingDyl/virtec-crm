import { NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';
import { AdminNotConfiguredError } from '@/lib/firebase-admin';
import {
  MAX_UPLOAD_BYTES,
  buildStoragePath,
  deleteStoredObject,
  isSafeStoragePath,
  signedReadUrl,
  signedUploadUrl,
} from '@/lib/storage-server';

export const dynamic = 'force-dynamic';

/**
 * Storage brokerage for the CRM.
 *
 * Every action here requires a verified operator session — storage rules deny
 * the browser outright, so this is the only way in. Paths are validated
 * server-side rather than trusted from the request.
 */
type Action =
  | { action: 'upload'; prefix?: string; fileName?: string; contentType?: string; size?: number }
  | { action: 'read'; path?: string }
  | { action: 'delete'; paths?: string[] };

const UPLOAD_PREFIXES = new Set(['documents', 'receipts', 'design', 'quotes', 'invoices', 'agreements']);

export async function POST(request: NextRequest) {
  let operator;
  try {
    operator = await getOperator();
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Storage is unavailable.' }, { status: 503 });
    }
    throw error;
  }

  if (!operator) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: Action;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  try {
    switch (body.action) {
      case 'upload': {
        const { prefix, fileName, contentType, size } = body;
        if (!prefix || !fileName || !contentType || !UPLOAD_PREFIXES.has(prefix)) {
          return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
        }
        if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: `Files must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
            { status: 413 }
          );
        }
        const path = buildStoragePath(prefix, fileName);
        return NextResponse.json(await signedUploadUrl(path, contentType));
      }

      case 'read': {
        const { path } = body;
        if (!path) return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
        const url = await signedReadUrl(path);
        if (!url) return NextResponse.json({ error: 'File not available.' }, { status: 404 });
        return NextResponse.json({ url });
      }

      case 'delete': {
        const { paths } = body;
        if (!Array.isArray(paths)) {
          return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
        }
        await Promise.all(paths.filter(isSafeStoragePath).map(deleteStoredObject));
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Storage is unavailable.' }, { status: 503 });
    }
    console.error('storage action failed:', error);
    return NextResponse.json({ error: 'Storage request failed.' }, { status: 500 });
  }
}
