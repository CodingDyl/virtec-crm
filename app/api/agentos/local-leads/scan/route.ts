import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleAgentOSAuthError, verifyAgentOSWriteAuth } from '@/lib/agentos-auth';
import { AGENTOS_AUDIT_COLLECTION, readJsonObject, takeWriteSlot, unexpectedFields } from '@/lib/agentos-writes';
import { findScanArea } from '@/lib/local-leads/areas';
import { distinctPlacesTypes, SCAN_CATEGORIES } from '@/lib/local-leads/categories';
import { placesMonthlyCap, readPlacesBudget } from '@/lib/local-leads/places-budget';
import { runLocalLeadsScan } from '@/lib/local-leads/scan';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** One scan may make at most this many Places requests, however many categories are chosen. */
const MAX_REQUESTS_PER_SCAN = 15;

/**
 * POST /api/agentos/local-leads/scan
 *
 * Body: `{ "area": "<preset key>", "track": "virtara" | "jurivo", "categories": ["estate agents", ...] }`
 *
 * Starts a Places scan of one named area for the chosen categories and adds
 * what it finds to the local leads. Spends money, so it is careful:
 *
 * - it needs the write key, and refuses to run at all until
 *   `PLACES_MONTHLY_REQUEST_CAP` is set (503), so the ceiling is a decision
 *   you made rather than a default;
 * - one scan is at most 15 requests, and stops early if the month's budget
 *   runs out;
 * - the area must be a preset and the categories must be known ones, so a
 *   typo cannot spend a scan on the wrong thing.
 *
 * Existing lead statuses are preserved by the scan itself, so a rescan never
 * undoes a decision.
 */
export async function POST(request: NextRequest) {
  try {
    await verifyAgentOSWriteAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY is not configured' }, { status: 503 });
  if (placesMonthlyCap() === undefined) {
    return NextResponse.json(
      { error: 'Scans from AgentOS are off until PLACES_MONTHLY_REQUEST_CAP is set to the most Places requests you will pay for in a month' },
      { status: 503 },
    );
  }

  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });

  const extra = unexpectedFields(body, ['area', 'track', 'categories']);
  if (extra.length > 0) return NextResponse.json({ error: `Unexpected fields: ${extra.join(', ')}` }, { status: 400 });

  const area = findScanArea(body.area);
  if (!area) return NextResponse.json({ error: 'area must be one of the presets from scan-info' }, { status: 400 });

  const track = body.track;
  if (track !== 'virtara' && track !== 'jurivo') return NextResponse.json({ error: 'track must be virtara or jurivo' }, { status: 400 });

  const known = SCAN_CATEGORIES.filter((category) => category.track === track);
  const wanted = Array.isArray(body.categories) ? body.categories : undefined;
  if (!wanted || wanted.length === 0 || wanted.length > 20 || !wanted.every((name) => typeof name === 'string')) {
    return NextResponse.json({ error: 'categories must be a short list of category names' }, { status: 400 });
  }
  const unknown = (wanted as string[]).filter((name) => !known.some((category) => category.category === name));
  if (unknown.length > 0) return NextResponse.json({ error: `Unknown categories for ${track}: ${unknown.join(', ')}` }, { status: 400 });

  // The most it can cost: one request per distinct Places type across the chosen categories.
  const types = new Set(distinctPlacesTypes(known.filter((category) => (wanted as string[]).includes(category.category))));
  if (types.size > MAX_REQUESTS_PER_SCAN) {
    return NextResponse.json({ error: `That is up to ${types.size} Places requests; a scan is limited to ${MAX_REQUESTS_PER_SCAN}. Choose fewer categories.` }, { status: 400 });
  }

  const budget = await readPlacesBudget();
  if (budget.remaining !== null && budget.remaining < types.size) {
    return NextResponse.json(
      { error: `This scan needs up to ${types.size} requests and ${budget.remaining} are left this month (limit ${budget.cap}).`, budget },
      { status: 429 },
    );
  }

  if (!takeWriteSlot()) return NextResponse.json({ error: 'Too many AgentOS writes; try again in a minute' }, { status: 429 });

  try {
    const summary = await runLocalLeadsScan({
      apiKey,
      track,
      area: area.label,
      lat: area.lat,
      lng: area.lng,
      radiusMeters: area.radiusMeters,
      categories: wanted as string[],
    });

    // Written after the fact: there is no single document to change in one transaction.
    await getAdminDb()
      .collection(AGENTOS_AUDIT_COLLECTION)
      .add({
        route: 'POST /api/agentos/local-leads/scan',
        collection: 'localLeads',
        docId: summary.scanRunId,
        before: {},
        after: { area: area.key, track, categories: wanted, requests: summary.requests ?? 0, fetched: summary.fetched, upserted: summary.upserted },
        actor: 'agentos',
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch((error) => console.error('Could not record the scan audit:', error));

    return NextResponse.json({ summary, budget: await readPlacesBudget() });
  } catch (error) {
    console.error('AgentOS local-leads scan failed:', error);
    return NextResponse.json({ error: 'The scan failed' }, { status: 500 });
  }
}
