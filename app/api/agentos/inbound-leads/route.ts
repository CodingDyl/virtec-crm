import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';
import { INBOUND_LEADS_COLLECTION, INBOUND_LEAD_STATUSES, type InboundLeadStatus } from '@/types/inbound-lead';

export const dynamic = 'force-dynamic';

function iso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/**
 * GET /api/agentos/inbound-leads
 *
 * Leads from our own websites, newest first.
 *
 * Query params:
 *   - limit: default 100, max 500
 *   - status: new | reviewing | replied | won | not_a_fit | spam
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAgentOSAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : 100, 500);
    const status = searchParams.get('status');
    if (status && !INBOUND_LEAD_STATUSES.includes(status as InboundLeadStatus)) {
      return NextResponse.json({ error: `status must be one of: ${INBOUND_LEAD_STATUSES.join(', ')}` }, { status: 400 });
    }

    const collection = getAdminDb().collection(INBOUND_LEADS_COLLECTION);
    // A status filter plus an order would need a composite index; filtered
    // results are small, so they are sorted here instead.
    const snapshot = status
      ? await collection.where('status', '==', status).limit(limit).get()
      : await collection.orderBy('createdAt', 'desc').limit(limit).get();

    const leads = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          track: data.track,
          source: data.source,
          status: data.status,
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          website: data.website,
          message: data.message,
          details: data.details ?? {},
          consent: data.consent === true,
          utm: data.utm,
          page: data.page,
          createdAt: iso(data.createdAt),
          updatedAt: iso(data.updatedAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json({ leads, count: leads.length, limit });
  } catch (error) {
    console.error('AgentOS inbound leads API error:', error);
    return NextResponse.json({ error: 'Failed to fetch inbound leads' }, { status: 500 });
  }
}
