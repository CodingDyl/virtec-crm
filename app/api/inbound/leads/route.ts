import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifySiteKey } from '@/lib/inbound-auth';
import { inboundDedupeKey, validateInboundLead, withoutUndefined } from '@/lib/inbound-leads';
import { notifyInboundLead } from '@/lib/inbound-notify';
import { INBOUND_LEADS_COLLECTION, type InboundLeadTrack } from '@/types/inbound-lead';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16_000;
const DUPLICATE_WINDOW_MS = 10 * 60_000;

/**
 * Per-instance, per-site rate limit. It bounds a broken form or a bot loop on
 * one warm instance; each site also limits by visitor IP before forwarding.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const windows = new Map<InboundLeadTrack, { start: number; count: number }>();

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
 * POST /api/inbound/leads
 *
 * Called server-to-server by our websites (never from a browser: there is no
 * CORS, and the key must not ship to a client). The key decides the track.
 *
 * 201 `{ id, duplicate: false }` for a new lead. 200 `{ id, duplicate: true }`
 * when the same email sent the same form in the last ten minutes, so a double
 * submit makes one lead, not two.
 */
export async function POST(request: NextRequest) {
  const auth = verifySiteKey(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { track } = auth;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const { lead, errors } = validateInboundLead(body as Record<string, unknown>);
  if (!lead) return NextResponse.json({ error: 'Invalid lead', details: errors }, { status: 400 });

  if (!takeSlot(track)) {
    return NextResponse.json({ error: 'Too many leads from this site; try again in a minute' }, { status: 429 });
  }

  const db = getAdminDb();
  const dedupeKey = inboundDedupeKey(track, lead.email, lead.source);

  try {
    const recent = await db.collection(INBOUND_LEADS_COLLECTION).where('dedupeKey', '==', dedupeKey).limit(20).get();
    const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
    const duplicate = recent.docs.find((doc) => {
      const createdAt = doc.get('createdAt');
      return createdAt instanceof Timestamp && createdAt.toMillis() >= cutoff;
    });
    if (duplicate) return NextResponse.json({ id: duplicate.id, duplicate: true });

    const ref = db.collection(INBOUND_LEADS_COLLECTION).doc();
    await ref.set(
      withoutUndefined({
        ...lead,
        track,
        status: 'new',
        dedupeKey,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );

    await notifyInboundLead(track, lead, ref.id);
    return NextResponse.json({ id: ref.id, duplicate: false }, { status: 201 });
  } catch (error) {
    console.error('Inbound lead save failed:', error);
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
  }
}
