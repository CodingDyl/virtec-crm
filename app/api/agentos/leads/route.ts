import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';
import { LOCAL_LEADS_COLLECTION } from '@/types/local-lead';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/leads
 * 
 * Returns read-only local leads data for AgentOS.
 * Excludes any credential or password fields.
 * 
 * Query params:
 *   - limit: number of records to return (default: 100, max: 500)
 *   - status: filter by lead status (new, reviewing, qualified, disqualified, converted)
 *   - track: filter by track (virtara, jurivo)
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
    const track = searchParams.get('track');

    const db = getAdminDb();
    let query = db.collection(LOCAL_LEADS_COLLECTION).limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (track) {
      query = query.where('track', '==', track);
    }

    const snapshot = await query.get();
    
    const leads = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Strip any fields that should not be exposed
      // (No password/credential fields exist in local leads, but being explicit)
      return {
        id: doc.id,
        googlePlaceId: data.googlePlaceId,
        name: data.name,
        phone: data.phone,
        websiteUrl: data.websiteUrl,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        category: data.category,
        primaryType: data.primaryType,
        track: data.track,
        area: data.area,
        suburb: data.suburb,
        websiteSignal: data.websiteSignal,
        hasWebsite: data.hasWebsite,
        rating: data.rating,
        reviewCount: data.reviewCount,
        score: data.score,
        scoreReasons: data.scoreReasons,
        status: data.status,
        customerId: data.customerId,
        source: data.source,
        lastFetchedAt: data.lastFetchedAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        scanRunId: data.scanRunId,
        notes: data.notes,
        ownerEmail: data.ownerEmail,
        emailConfidence: data.emailConfidence,
        enrichedAt: data.enrichedAt,
        enrichSource: data.enrichSource,
        enrichError: data.enrichError,
        outreachStage: data.outreachStage,
        outreach1SentAt: data.outreach1SentAt,
        outreach2SentAt: data.outreach2SentAt,
        outreach3SentAt: data.outreach3SentAt,
        outreachRepliedAt: data.outreachRepliedAt,
        selectedTemplateId: data.selectedTemplateId,
        outreachPitch: data.outreachPitch,
      };
    });

    return NextResponse.json({
      leads,
      count: leads.length,
      limit,
    });
  } catch (error) {
    console.error('AgentOS leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
