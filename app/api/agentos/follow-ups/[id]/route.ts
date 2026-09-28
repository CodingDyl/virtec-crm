import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleAgentOSAuthError, verifyAgentOSWriteAuth } from '@/lib/agentos-auth';
import {
  isDocId,
  readJsonObject,
  recordAudit,
  takeWriteSlot,
  unexpectedFields,
  WriteConflict,
  WriteNotFound,
} from '@/lib/agentos-writes';
import { FOLLOW_UP_COLLECTION } from '@/lib/follow-ups';
import type { FollowUpStatus } from '@/types/follow-up';

export const dynamic = 'force-dynamic';

/** What AgentOS may set. `open` is not here: reopening is a decision for the CRM. */
const SETTABLE: readonly FollowUpStatus[] = ['sent', 'dismissed', 'snoozed'];
/** A snooze longer than this is a dismissal wearing a disguise. */
const MAX_SNOOZE_DAYS = 90;

function activityTarget(data: Record<string, any>): { refType: 'project' | 'customer'; refId: string } | null {
  if (data.projectId) return { refType: 'project', refId: data.projectId };
  if (data.customerId) return { refType: 'customer', refId: data.customerId };
  return null;
}

const ACTIVITY_MESSAGE: Record<string, string> = {
  sent: 'Follow-up marked sent from AgentOS',
  dismissed: 'Follow-up dismissed from AgentOS',
  snoozed: 'Follow-up snoozed from AgentOS',
};

/**
 * PATCH /api/agentos/follow-ups/:id
 *
 * Body: `{ "status": "sent" | "dismissed" | "snoozed", "snoozedUntil"?: ISO date }`
 *
 * Marks a follow-up handled from AgentOS — the operator followed up in their
 * own words, outside Virtec's email sender, and says so. No other field can be
 * changed, and a follow-up already sent or dismissed is left alone (409).
 *
 * The change, an entry in the project's or customer's activity log, and an
 * `agentos_audit` record are written in one transaction.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAgentOSWriteAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  const { id } = await params;
  if (!isDocId(id)) {
    return NextResponse.json({ error: 'Invalid follow-up id' }, { status: 400 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const extra = unexpectedFields(body, ['status', 'snoozedUntil']);
  if (extra.length > 0) {
    return NextResponse.json({ error: `Unexpected fields: ${extra.join(', ')}` }, { status: 400 });
  }

  const status = body.status as FollowUpStatus;
  if (!SETTABLE.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${SETTABLE.join(', ')}` }, { status: 400 });
  }

  let snoozedUntil: Date | undefined;
  if (status === 'snoozed') {
    const parsed = typeof body.snoozedUntil === 'string' ? new Date(body.snoozedUntil) : undefined;
    const days = parsed ? (parsed.getTime() - Date.now()) / 86_400_000 : NaN;
    if (!parsed || Number.isNaN(parsed.getTime()) || days <= 0 || days > MAX_SNOOZE_DAYS) {
      return NextResponse.json({ error: `snoozedUntil must be a future date within ${MAX_SNOOZE_DAYS} days` }, { status: 400 });
    }
    snoozedUntil = parsed;
  } else if (body.snoozedUntil !== undefined) {
    return NextResponse.json({ error: 'snoozedUntil is only allowed with status "snoozed"' }, { status: 400 });
  }

  if (!takeWriteSlot()) {
    return NextResponse.json({ error: 'Too many AgentOS writes; try again in a minute' }, { status: 429 });
  }

  const db = getAdminDb();
  const ref = db.collection(FOLLOW_UP_COLLECTION).doc(id);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new WriteNotFound();

      const data = snapshot.data() ?? {};
      if (data.status === 'sent' || data.status === 'dismissed') {
        throw new WriteConflict(`Follow-up is already ${data.status}`);
      }

      const update: Record<string, unknown> = { status, updatedAt: FieldValue.serverTimestamp() };
      if (status === 'sent') update.lastSentAt = FieldValue.serverTimestamp();
      if (status === 'snoozed') update.snoozedUntil = Timestamp.fromDate(snoozedUntil as Date);

      transaction.update(ref, update);

      const target = activityTarget(data);
      if (target) {
        transaction.set(db.collection('activity').doc(), {
          ...target,
          type: 'follow_up',
          message: `${ACTIVITY_MESSAGE[status]}: ${data.reason ?? 'Follow-up'}`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      recordAudit(transaction, {
        route: 'PATCH /api/agentos/follow-ups/:id',
        collection: FOLLOW_UP_COLLECTION,
        docId: id,
        before: { status: data.status ?? null, snoozedUntil: data.snoozedUntil ?? null },
        after: { status, snoozedUntil: snoozedUntil?.toISOString() ?? null },
      });

      return { id, status, snoozedUntil: snoozedUntil?.toISOString() };
    });

    return NextResponse.json({ followUp: result });
  } catch (error) {
    if (error instanceof WriteNotFound) {
      return NextResponse.json({ error: 'No such follow-up' }, { status: 404 });
    }
    if (error instanceof WriteConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('AgentOS follow-up update failed:', error);
    return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 });
  }
}
