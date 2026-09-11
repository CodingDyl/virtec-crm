import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';
import { enrichLocalLeads } from '@/lib/local-leads/enrich';
import type { LocalLeadStatus } from '@/types/local-lead';
import { LOCAL_LEAD_STATUSES } from '@/types/local-lead';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_ENRICH_STATUSES = new Set<LocalLeadStatus>(['qualified', 'reviewing']);

/**
 * POST /api/local-leads/enrich
 * Operator-only owner-email enrich (scrape + optional paid API).
 * Does NOT send email — Attach HOLD.
 */
export async function POST(request: Request) {
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    leadIds?: string[];
    limit?: number;
    statuses?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body — defaults apply
  }

  const leadIds = Array.isArray(body.leadIds)
    ? body.leadIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : undefined;

  const limit =
    typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : undefined;

  let statuses: LocalLeadStatus[] | undefined;
  if (Array.isArray(body.statuses) && body.statuses.length > 0) {
    statuses = body.statuses.filter(
      (s): s is LocalLeadStatus =>
        typeof s === 'string' &&
        (LOCAL_LEAD_STATUSES as string[]).includes(s) &&
        ALLOWED_ENRICH_STATUSES.has(s as LocalLeadStatus)
    );
    if (statuses.length === 0) {
      return NextResponse.json(
        { error: "statuses must be subset of ['qualified','reviewing']" },
        { status: 400 }
      );
    }
  }

  try {
    const summary = await enrichLocalLeads({ leadIds, limit, statuses });
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('local-leads enrich failed', error);
    return NextResponse.json(
      { error: error?.message || 'Enrich failed' },
      { status: 500 }
    );
  }
}
