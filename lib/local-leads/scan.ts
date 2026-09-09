import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { SCAN_CATEGORIES } from '@/lib/local-leads/categories';
import {
  DEFAULT_SANDTON,
  PlacesApiError,
  rateLimitPause,
  searchNearby,
} from '@/lib/local-leads/places';
import { matchesExistingCustomer, scoreLocalLead } from '@/lib/local-leads/score';
import {
  detectWebsiteSignal,
  hasWebsiteFromSignal,
} from '@/lib/local-leads/website-signal';
import type {
  LocalLeadStatus,
  LocalLeadTrack,
  LocalLeadsScanSummary,
} from '@/types/local-lead';

export type LocalLeadsScanOptions = {
  track?: LocalLeadTrack | 'all';
  radiusMeters?: number;
  lat?: number;
  lng?: number;
  maxCategories?: number;
  apiKey: string;
  area?: string;
};

const PRESERVED_STATUSES: LocalLeadStatus[] = [
  'reviewing',
  'qualified',
  'converted',
  'disqualified',
];

function suburbFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  // Heuristic: suburb often second-to-last before city/province
  if (parts.length >= 3) return parts[parts.length - 3] ?? parts[1] ?? null;
  if (parts.length >= 2) return parts[0] ?? null;
  return null;
}

export async function runLocalLeadsScan(
  opts: LocalLeadsScanOptions
): Promise<LocalLeadsScanSummary> {
  const apiKey = opts.apiKey?.trim();
  if (!apiKey) {
    const err = new Error('GOOGLE_PLACES_API_KEY is not configured') as Error & {
      status?: number;
    };
    err.status = 503;
    throw err;
  }

  const trackFilter = opts.track ?? 'all';
  const lat = opts.lat ?? DEFAULT_SANDTON.lat;
  const lng = opts.lng ?? DEFAULT_SANDTON.lng;
  const radiusMeters = opts.radiusMeters ?? DEFAULT_SANDTON.radiusMeters;
  const area = opts.area ?? 'Sandton';
  const scanRunId = crypto.randomUUID();

  const db = getAdminDb();

  const customersSnap = await db.collection('customers').get();
  const customers = customersSnap.docs.map((d) => d.data() as {
    companyName?: string;
    name?: string;
    contactNumber?: string;
    phone?: string;
  });

  let categories = SCAN_CATEGORIES.filter(
    (c) => trackFilter === 'all' || c.track === trackFilter
  );
  if (opts.maxCategories && opts.maxCategories > 0) {
    categories = categories.slice(0, opts.maxCategories);
  }

  const summary: LocalLeadsScanSummary = {
    scanRunId,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [],
    byCategory: {},
    track: trackFilter,
  };

  // Deduplicate within a run (same place can appear under multiple types)
  const seenPlaceIds = new Set<string>();

  for (const cat of categories) {
    if (!summary.byCategory[cat.category]) {
      summary.byCategory[cat.category] = { fetched: 0, upserted: 0 };
    }

    for (const includedType of cat.includedTypes) {
      try {
        await rateLimitPause();
        const places = await searchNearby({
          lat,
          lng,
          radiusMeters,
          includedType,
          apiKey,
        });

        for (const place of places) {
          summary.fetched += 1;
          summary.byCategory[cat.category].fetched += 1;

          if (seenPlaceIds.has(place.googlePlaceId)) {
            summary.skipped += 1;
            continue;
          }
          seenPlaceIds.add(place.googlePlaceId);

          const websiteSignal = detectWebsiteSignal(place.websiteUrl);
          const existingCustomer = matchesExistingCustomer(
            { name: place.name, phone: place.phone },
            customers
          );
          const { score, scoreReasons } = scoreLocalLead({
            websiteSignal,
            matchesExistingCustomer: existingCustomer,
          });

          const ref = db.collection('localLeads').doc(place.googlePlaceId);
          const existing = await ref.get();
          const existingData = existing.exists ? (existing.data() as any) : null;

          const preserveStatus =
            existingData &&
            PRESERVED_STATUSES.includes(existingData.status as LocalLeadStatus);

          const payload: Record<string, unknown> = {
            googlePlaceId: place.googlePlaceId,
            name: place.name,
            phone: place.phone ?? null,
            websiteUrl: place.websiteUrl ?? null,
            address: place.address ?? null,
            lat: place.lat ?? null,
            lng: place.lng ?? null,
            category: cat.category,
            primaryType: place.primaryType ?? includedType,
            track: cat.track,
            area,
            suburb: suburbFromAddress(place.address),
            websiteSignal,
            hasWebsite: hasWebsiteFromSignal(websiteSignal),
            rating: place.rating ?? null,
            reviewCount: place.reviewCount ?? null,
            score,
            scoreReasons,
            source: 'google_places',
            lastFetchedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            scanRunId,
            raw: place.raw,
          };

          if (!existing.exists) {
            payload.status = 'new';
            payload.createdAt = FieldValue.serverTimestamp();
          } else if (!preserveStatus && !existingData?.status) {
            payload.status = 'new';
          }
          // else: leave status alone (operator-owned)

          // Never wipe customerId if set; never set on ingest
          if (existingData?.customerId) {
            payload.customerId = existingData.customerId;
          }

          await ref.set(payload, { merge: true });
          summary.upserted += 1;
          summary.byCategory[cat.category].upserted += 1;
        }
      } catch (error: any) {
        const message =
          error instanceof PlacesApiError
            ? `${cat.category}/${includedType}: ${error.message}`
            : `${cat.category}/${includedType}: ${error?.message || String(error)}`;
        summary.errors.push(message);
        console.error('local-leads Places search failed', message);
      }
    }
  }

  return summary;
}
