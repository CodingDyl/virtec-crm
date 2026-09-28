import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/clients
 * 
 * Returns read-only customer/client data for AgentOS.
 * Excludes any credential or password fields.
 * 
 * Query params:
 *   - limit: number of records to return (default: 100, max: 500)
 *   - status: filter by status (true/false for active/inactive)
 *   - maintenance: filter by maintenance status (true/false)
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
    const statusParam = searchParams.get('status');
    const maintenanceParam = searchParams.get('maintenance');

    const db = getAdminDb();
    let query = db.collection('customers').limit(limit);

    if (statusParam !== null) {
      const status = statusParam === 'true';
      query = query.where('status', '==', status);
    }
    
    if (maintenanceParam !== null) {
      const maintenance = maintenanceParam === 'true';
      query = query.where('maintenance', '==', maintenance);
    }

    const snapshot = await query.get();
    
    const clients = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Explicitly exclude any password/credential fields
      // Customer model does not have passwords, but being defensive
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        companyName: data.companyName,
        contactNumber: data.contactNumber,
        totalSpent: data.totalSpent,
        maintenance: data.maintenance,
        status: data.status,
        createdAt: data.createdAt,
        created_at: data.created_at,
      };
    });

    return NextResponse.json({
      clients,
      count: clients.length,
      limit,
    });
  } catch (error) {
    console.error('AgentOS clients API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
