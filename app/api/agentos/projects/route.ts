import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/projects
 * 
 * Returns read-only project data for AgentOS.
 * Excludes any credential or password fields (e.g., portalToken is excluded).
 * 
 * Query params:
 *   - limit: number of records to return (default: 100, max: 500)
 *   - status: filter by status (active, completed, on-hold, etc.)
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
    let query = db.collection('projects').limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    
    const projects = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Exclude credential fields
      // portalToken is a secret share link - exclude it
      return {
        id: doc.id,
        projectType: data.projectType,
        clientName: data.clientName,
        clientId: data.clientId,
        amount: data.amount,
        status: data.status,
        completion: data.completion,
        quoteId: data.quoteId,
        agreementUrl: data.agreementUrl,
        agreementPath: data.agreementPath,
        agreementStatus: data.agreementStatus,
        createdAt: data.createdAt,
        // Portal fields: exclude portalToken (secret), but include metadata
        portalEnabled: data.portalEnabled,
        portalCreatedAt: data.portalCreatedAt,
        portalLastViewedAt: data.portalLastViewedAt,
        // Maintenance fields
        maintenanceFrequency: data.maintenanceFrequency,
        maintenanceAmount: data.maintenanceAmount,
        serviceSku: data.serviceSku,
        // Delivery Ops fields
        waitingOnClientSince: data.waitingOnClientSince,
        pausedAt: data.pausedAt,
        pauseReason: data.pauseReason,
      };
    });

    return NextResponse.json({
      projects,
      count: projects.length,
      limit,
    });
  } catch (error) {
    console.error('AgentOS projects API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
