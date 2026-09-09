import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Local leads Sandton scan.
 * Full Places ingest lands on this route; until GOOGLE_PLACES_API_KEY is set
 * we fail clearly so the FE Scan button can wire against a stable contract.
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
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  // Implementation module may not be ready on first push — dynamic import.
  try {
    const { runLocalLeadsScan } = await import('@/lib/local-leads/scan');
    const summary = await runLocalLeadsScan({
      track: body.track ?? 'all',
      radiusMeters: body.radiusMeters,
      lat: body.lat,
      lng: body.lng,
      apiKey,
    });
    return NextResponse.json(summary);
  } catch (error: any) {
    if (error?.code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(String(error))) {
      return NextResponse.json({
        status: 'scaffolded',
        message: 'Scan route live; Places ingest module landing next',
        scanRunId: null,
        fetched: 0,
        upserted: 0,
        track: body.track ?? 'all',
      });
    }
    console.error('local-leads scan failed', error);
    return NextResponse.json(
      { error: error?.message || 'Scan failed' },
      { status: 500 }
    );
  }
}
