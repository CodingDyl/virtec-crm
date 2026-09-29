import { NextRequest, NextResponse } from 'next/server';
import { verifySiteKey } from '@/lib/inbound-auth';
import { applySubscriberRequest, validateSubscriberRequest } from '@/lib/subscribers';
import type { InboundLeadTrack } from '@/types/inbound-lead';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const windows = new Map<InboundLeadTrack, { start: number; count: number }>();

/** Per-instance, per-site. Each site also limits by visitor IP before forwarding. */
function takeSlot(track: InboundLeadTrack, now = Date.now()): boolean {
  const window = windows.get(track);
  if (!window || now - window.start >= WINDOW_MS) {
    windows.set(track, { start: now, count: 1 });
    return true;
  }
  if (window.count >= MAX_PER_WINDOW) return false;
  window.count += 1;
  return true;
}

/**
 * POST /api/inbound/subscribers
 *
 * Body: `{ "action": "subscribe" | "unsubscribe", "email": "...", "name": "..." }`
 *
 * Called server-to-server by a website with its site key (the same keys as
 * `/api/inbound/leads`). The answer is `{ ok: true }` whether or not the
 * list changed, so the form cannot be used to learn who is subscribed.
 */
export async function POST(request: NextRequest) {
  const auth = verifySiteKey(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Body too large' }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const { request: parsed, errors } = validateSubscriberRequest(body as Record<string, unknown>);
  if (!parsed) return NextResponse.json({ error: 'Invalid request', details: errors }, { status: 400 });

  if (!takeSlot(auth.track)) {
    return NextResponse.json({ error: 'Too many requests; try again in a minute' }, { status: 429 });
  }

  try {
    await applySubscriberRequest(parsed, auth.track);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Subscriber update failed:', error);
    return NextResponse.json({ error: 'Failed to update the list' }, { status: 500 });
  }
}
