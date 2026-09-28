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
  WriteConflict,
  WriteNotFound,
} from '@/lib/agentos-writes';
import { LOCAL_LEADS_COLLECTION, type LocalLeadStatus } from '@/types/local-lead';

export const dynamic = 'force-dynamic';

/**
 * What AgentOS may set.
 *
 * Not `converted`: converting a lead creates and links a customer, which is
 * the CRM's own flow. And a converted lead is not moved back from here — that
 * would orphan the customer it became.
 */
const SETTABLE: readonly LocalLeadStatus[] = ['new', 'reviewing', 'qualified', 'disqualified'];

/**
 * PATCH /api/agentos/leads/:id
 *
 * Body: `{ "status": "new" | "reviewing" | "qualified" | "disqualified" }`
 *
 * Lets AgentOS triage Virtec's local leads — "reviewing" when a lead is taken
 * into Traction, "disqualified" when it is not a fit. Only `status` can be
 * changed. The change and an `agentos_audit` record are written in one
 * transaction. Places scans preserve these statuses, so a rescan does not
 * undo them.
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

  const status = body.status as LocalLeadStatus;
  if (!SETTABLE.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${SETTABLE.join(', ')}` }, { status: 400 });
  }

  if (!takeWriteSlot()) {
    return NextResponse.json({ error: 'Too many AgentOS writes; try again in a minute' }, { status: 429 });
  }

  const db = getAdminDb();
  const ref = db.collection(LOCAL_LEADS_COLLECTION).doc(id);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new WriteNotFound();

      const data = snapshot.data() ?? {};
      if (data.status === 'converted') {
        throw new WriteConflict('Lead is already converted to a customer');
      }
      if (data.status === status) {
        return { id, status, changed: false };
      }

      transaction.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
      recordAudit(transaction, {
        route: 'PATCH /api/agentos/leads/:id',
        collection: LOCAL_LEADS_COLLECTION,
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
    if (error instanceof WriteConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('AgentOS lead update failed:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
