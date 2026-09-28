import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleAgentOSAuthError, verifyAgentOSWriteAuth } from '@/lib/agentos-auth';
import {
  isDocId,
  readJsonObject,
  recordAudit,
  takeWriteSlot,
  unexpectedFields,
  WriteNotFound,
} from '@/lib/agentos-writes';
import { INBOUND_LEADS_COLLECTION, type InboundLeadStatus } from '@/types/inbound-lead';

export const dynamic = 'force-dynamic';

/** What AgentOS may set. `won` stays a CRM decision, made where the customer is created. */
const SETTABLE: readonly InboundLeadStatus[] = ['new', 'reviewing', 'replied', 'not_a_fit', 'spam'];

/**
 * PATCH /api/agentos/inbound-leads/:id
 *
 * Body: `{ "status": "new" | "reviewing" | "replied" | "not_a_fit" | "spam" }`
 *
 * "reviewing" when AgentOS takes the lead into Traction, "replied" once the
 * reply is sent. Only `status` can change; the change and an `agentos_audit`
 * record are written in one transaction.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAgentOSWriteAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  const { id } = await params;
  if (!isDocId(id)) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const extra = unexpectedFields(body, ['status']);
  if (extra.length > 0) {
    return NextResponse.json({ error: `Unexpected fields: ${extra.join(', ')}` }, { status: 400 });
  }

  const status = body.status as InboundLeadStatus;
  if (!SETTABLE.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${SETTABLE.join(', ')}` }, { status: 400 });
  }

  if (!takeWriteSlot()) {
    return NextResponse.json({ error: 'Too many AgentOS writes; try again in a minute' }, { status: 429 });
  }

  const db = getAdminDb();
  const ref = db.collection(INBOUND_LEADS_COLLECTION).doc(id);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new WriteNotFound();

      const data = snapshot.data() ?? {};
      if (data.status === status) return { id, status, changed: false };

      transaction.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
      recordAudit(transaction, {
        route: 'PATCH /api/agentos/inbound-leads/:id',
        collection: INBOUND_LEADS_COLLECTION,
        docId: id,
        before: { status: data.status ?? null },
        after: { status },
      });
      return { id, status, changed: true };
    });

    return NextResponse.json({ lead: result });
  } catch (error) {
    if (error instanceof WriteNotFound) {
      return NextResponse.json({ error: 'No such lead' }, { status: 404 });
    }
    console.error('AgentOS inbound lead update failed:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
