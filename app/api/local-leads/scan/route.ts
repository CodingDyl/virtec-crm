import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';
import { runLocalLeadsScan } from '@/lib/local-leads/scan';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/local-leads/scan
 * Operator-only Places (New) nearby scan → upsert localLeads.
 */
export async function POST(request: Request) {
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY is not configured' },
      { status: 503 }
    );
  }

  let body: {
    track?: 'virtara' | 'jurivo' | 'all';
    radiusMeters?: number;
    lat?: number;
    lng?: number;
    maxCategories?: number;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — defaults to Sandton / all tracks
  }

  try {
    const summary = await runLocalLeadsScan({
      track: body.track ?? 'all',
      radiusMeters: body.radiusMeters,
      lat: body.lat,
      lng: body.lng,
      maxCategories: body.maxCategories,
      apiKey,
    });
    return NextResponse.json(summary);
  } catch (error: any) {
    if (
      error?.status === 503 ||
      error?.message === 'GOOGLE_PLACES_API_KEY is not configured'
    ) {
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY is not configured' },
        { status: 503 }
      );
    }
    console.error('local-leads scan failed', error);
    return NextResponse.json(
      { error: error?.message || 'Scan failed' },
      { status: 500 }
    );
  }
}
