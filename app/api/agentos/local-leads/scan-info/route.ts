import { NextRequest, NextResponse } from 'next/server';
import { handleAgentOSAuthError, verifyAgentOSAuth } from '@/lib/agentos-auth';
import { SCAN_AREAS } from '@/lib/local-leads/areas';
import { SCAN_CATEGORIES } from '@/lib/local-leads/categories';
import { readPlacesBudget } from '@/lib/local-leads/places-budget';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/local-leads/scan-info
 *
 * What a scan can be pointed at, and what is left to spend this month:
 * the areas, the categories (with the Places types each searches, so a
 * caller can count the requests a choice would make), and the monthly
 * budget. Read-only.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAgentOSAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  try {
    const budget = await readPlacesBudget();
    return NextResponse.json({
      areas: SCAN_AREAS.map(({ key, label }) => ({ key, label })),
      categories: SCAN_CATEGORIES.map((category) => ({
        category: category.category,
        track: category.track,
        // The Places types it searches. A type shared by several categories is one request.
        types: category.includedTypes,
      })),
      budget,
    });
  } catch (error) {
    console.error('AgentOS scan info failed:', error);
    return NextResponse.json({ error: 'Failed to read the scan options' }, { status: 500 });
  }
}
