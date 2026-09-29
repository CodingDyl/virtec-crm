import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleAgentOSAuthError, verifyAgentOSWriteAuth } from '@/lib/agentos-auth';
import { readJsonObject, recordAudit, takeWriteSlot } from '@/lib/agentos-writes';
import { isMagnetSlug, MAGNET_EMAILS_COLLECTION, validateMagnetEmail } from '@/lib/magnet-emails';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/agentos/lead-magnet-emails/:slug
 *
 * Body: `{ "track": "virtara" | "jurivo", "subject": "...", "body": "... {{link}} ...",
 *          "readUrl": "https://...", "enabled": true }`
 *
 * Publishes (or replaces, or switches off) the email a `magnet-<slug>`
 * signup receives. Written with an `agentos_audit` record in one
 * transaction; the audit keeps the subject and whether it is on, not the
 * whole body.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await verifyAgentOSWriteAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  const { slug } = await params;
  if (!isMagnetSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const { email, errors } = validateMagnetEmail(body);
  if (!email) return NextResponse.json({ error: 'Invalid email', details: errors }, { status: 400 });

  if (!takeWriteSlot()) {
    return NextResponse.json({ error: 'Too many AgentOS writes; try again in a minute' }, { status: 429 });
  }

  const db = getAdminDb();
  const ref = db.collection(MAGNET_EMAILS_COLLECTION).doc(slug);

  try {
    await db.runTransaction(async (transaction) => {
      const before = await transaction.get(ref);
      const previous = before.data();
      transaction.set(ref, { ...email, slug, updatedAt: FieldValue.serverTimestamp() });
      recordAudit(transaction, {
        route: 'PUT /api/agentos/lead-magnet-emails/:slug',
        collection: MAGNET_EMAILS_COLLECTION,
        docId: slug,
        before: previous ? { subject: previous.subject ?? null, enabled: previous.enabled ?? null } : {},
        after: { subject: email.subject, enabled: email.enabled },
      });
    });
    return NextResponse.json({ email: { slug, track: email.track, subject: email.subject, enabled: email.enabled } });
  } catch (error) {
    console.error('AgentOS magnet email update failed:', error);
    return NextResponse.json({ error: 'Failed to save the email' }, { status: 500 });
  }
}
