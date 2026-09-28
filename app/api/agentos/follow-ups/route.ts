import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';
import { FOLLOW_UP_COLLECTION } from '@/lib/follow-ups';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/follow-ups
 * 
 * Returns read-only follow-up data for AgentOS.
 * Excludes any credential or password fields.
 * 
 * Query params:
 *   - limit: number of records to return (default: 100, max: 500)
 *   - status: filter by status (open, sent, dismissed, snoozed)
 *   - type: filter by type (quote_pending, agreement_pending, invoice_overdue, maintenance_renewal, project_stale)
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAgentOSAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '100', 10),
      500
    );
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const db = getAdminDb();
    let query = db.collection(FOLLOW_UP_COLLECTION).limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    
    const followUps = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Exclude credential fields (none in follow-ups, but being explicit)
      return {
        id: doc.id,
        type: data.type,
        status: data.status,
        customerId: data.customerId,
        customerName: data.customerName,
        companyName: data.companyName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        projectId: data.projectId,
        projectName: data.projectName,
        quoteId: data.quoteId,
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        dueAt: data.dueAt,
        snoozedUntil: data.snoozedUntil,
        reason: data.reason,
        suggestedSubject: data.suggestedSubject,
        suggestedMessage: data.suggestedMessage,
        lastSentAt: data.lastSentAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        sourceKey: data.sourceKey,
      };
    });

    return NextResponse.json({
      followUps,
      count: followUps.length,
      limit,
    });
  } catch (error) {
    console.error('AgentOS follow-ups API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups' },
      { status: 500 }
    );
  }
}
