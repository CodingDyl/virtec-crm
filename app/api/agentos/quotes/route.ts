import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/quotes
 * 
 * Returns read-only quote data for AgentOS.
 * Excludes any credential or password fields.
 * 
 * Query params:
 *   - limit: number of records to return (default: 100, max: 500)
 *   - status: filter by status (pending, accepted, rejected)
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

    const db = getAdminDb();
    let query = db.collection('quotes').limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    
    const quotes = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Exclude credential fields (none in quotes, but being explicit)
      return {
        id: doc.id,
        projectId: data.projectId,
        project_id: data.project_id,
        projectType: data.projectType,
        project_type: data.project_type,
        clientId: data.clientId,
        client_id: data.client_id,
        totalAmount: data.totalAmount,
        total_amount: data.total_amount,
        createdAt: data.createdAt,
        created_at: data.created_at,
        status: data.status,
        features: data.features,
        // Note: pdfUrl/pdfPath intentionally included - these are download URLs, not credentials
        pdfUrl: data.pdfUrl,
        pdf_url: data.pdf_url,
        pdfPath: data.pdfPath,
      };
    });

    return NextResponse.json({
      quotes,
      count: quotes.length,
      limit,
    });
  } catch (error) {
    console.error('AgentOS quotes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}
