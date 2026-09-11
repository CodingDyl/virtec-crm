import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  businessHostFromWebsiteUrl,
  extractEmailsFromHtml,
  isValidEmail,
  normalizeEmail,
  rankEmails,
  type ExtractedEmail,
} from '@/lib/local-leads/extract-emails';
import type {
  LocalLead,
  LocalLeadEmailConfidence,
  LocalLeadEnrichResultItem,
  LocalLeadEnrichSource,
  LocalLeadStatus,
  LocalLeadsEnrichSummary,
} from '@/types/local-lead';
import { LOCAL_LEADS_COLLECTION } from '@/types/local-lead';

const USER_AGENT = 'VirtaraCRMBot/1.0 (+https://virtara.io; local-leads enrich)';
const FETCH_TIMEOUT_MS = 8000;
const FETCH_GAP_MS = 300;
const PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us'] as const;
const CONTACT_PATHS = new Set(['/contact', '/contact-us']);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_STATUSES: LocalLeadStatus[] = ['qualified'];

export type EnrichLocalLeadsOptions = {
  leadIds?: string[];
  limit?: number;
  statuses?: LocalLeadStatus[];
};

type ScrapeHit = {
  email: string;
  confidence: LocalLeadEmailConfidence;
  source: LocalLeadEnrichSource;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampLimit(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw)));
}

function sameOriginUrl(base: URL, path: string): string {
  const u = new URL(path, base);
  // Force same host as the business site (no open redirects / CDN hops as start URL)
  u.protocol = base.protocol;
  u.host = base.host;
  return u.toString();
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(ct)) {
      return null;
    }
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Scrape homepage + contact/about paths for mailto + visible emails.
 * Same-origin only (final redirect host must match business host).
 */
export async function scrapeWebsiteEmails(
  websiteUrl: string
): Promise<{ hit: ScrapeHit | null; error?: string }> {
  let base: URL;
  try {
    base = new URL(websiteUrl.includes('://') ? websiteUrl : `https://${websiteUrl}`);
  } catch {
    return { hit: null, error: 'invalid_website_url' };
  }
  if (!/^https?:$/i.test(base.protocol)) {
    return { hit: null, error: 'unsupported_protocol' };
  }

  const businessHost = businessHostFromWebsiteUrl(base.toString());
  const candidates: { email: ExtractedEmail; fromContactPage: boolean }[] = [];
  let fetchedAny = false;
  let lastError: string | undefined;

  for (let i = 0; i < PATHS.length; i++) {
    if (i > 0) await sleep(FETCH_GAP_MS);
    const path = PATHS[i]!;
    const target = sameOriginUrl(base, path);
    const page = await fetchHtml(target);
    if (!page) {
      lastError = lastError ?? 'fetch_failed';
      continue;
    }
    const finalHost = hostOf(page.finalUrl);
    if (!businessHost || !finalHost || (finalHost !== businessHost && !finalHost.endsWith(`.${businessHost}`) && businessHost !== finalHost && !businessHost.endsWith(`.${finalHost}`))) {
      // Reject cross-origin redirects
      lastError = 'cross_origin_redirect';
      continue;
    }
    fetchedAny = true;
    const extracted = extractEmailsFromHtml(page.html);
    const fromContactPage = CONTACT_PATHS.has(path);
    for (const email of extracted) {
      candidates.push({ email, fromContactPage });
    }
  }

  if (!fetchedAny) {
    return { hit: null, error: lastError ?? 'no_pages_fetched' };
  }
  if (candidates.length === 0) {
    return { hit: null, error: 'no_emails_found' };
  }

  // Dedupe keeping mailto / contact-page flags
  const byEmail = new Map<string, { email: ExtractedEmail; fromContactPage: boolean }>();
  for (const c of candidates) {
    const prev = byEmail.get(c.email.email);
    if (!prev) {
      byEmail.set(c.email.email, c);
      continue;
    }
    byEmail.set(c.email.email, {
      email: {
        ...prev.email,
        fromMailto: prev.email.fromMailto || c.email.fromMailto,
      },
      fromContactPage: prev.fromContactPage || c.fromContactPage,
    });
  }

  const list = Array.from(byEmail.values());
  const ranked = rankEmails(
    list.map((l) => l.email),
    businessHost,
    { fromContactPage: list.some((l) => l.fromContactPage && l.email.email === list[0]?.email.email) }
  );
  // Re-rank with contact-page awareness per email
  const scored = list.map((l) => {
    const rankedIdx = ranked.findIndex((r) => r.email === l.email.email);
    let score = rankedIdx >= 0 ? ranked.length - rankedIdx : 0;
    if (l.fromContactPage) score += 5;
    if (l.email.fromMailto) score += 5;
    return { l, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.l;
  if (!best) return { hit: null, error: 'no_emails_found' };

  const isBiz =
    !!businessHost &&
    (best.email.domain === businessHost || best.email.domain.endsWith(`.${businessHost}`));

  let confidence: LocalLeadEmailConfidence = 'low';
  let source: LocalLeadEnrichSource = 'website_contact_page';

  if (best.email.fromMailto && isBiz) {
    confidence = 'high';
    source = 'website_mailto';
  } else if (best.email.fromMailto) {
    confidence = 'medium';
    source = 'website_mailto';
  } else if (best.fromContactPage && isBiz) {
    confidence = 'medium';
    source = 'website_contact_page';
  } else if (isBiz) {
    confidence = 'medium';
    source = 'website_contact_page';
  } else {
    confidence = 'low';
    source = best.fromContactPage ? 'website_contact_page' : 'website_mailto';
  }

  return {
    hit: {
      email: best.email.email,
      confidence,
      source,
    },
  };
}

type ApiEnrichResult = {
  email: string;
  confidence: LocalLeadEmailConfidence;
};

/**
 * Optional paid enrichment. Skips silently unless BOTH env vars are set.
 * Confidence from paid API is capped at medium.
 */
export async function tryEnrichmentApi(lead: LocalLead): Promise<ApiEnrichResult | null> {
  const apiKey = process.env.LOCAL_LEADS_ENRICH_API_KEY?.trim();
  const apiUrl = process.env.LOCAL_LEADS_ENRICH_API_URL?.trim();
  if (!apiKey || !apiUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        name: lead.name,
        websiteUrl: lead.websiteUrl ?? null,
        phone: lead.phone ?? null,
        address: lead.address ?? null,
        googlePlaceId: lead.googlePlaceId,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      email?: string;
      ownerEmail?: string;
      confidence?: string;
    };
    const raw = normalizeEmail(data.ownerEmail || data.email || '');
    if (!isValidEmail(raw)) return null;

    const confRaw = (data.confidence || 'medium').toLowerCase();
    let confidence: LocalLeadEmailConfidence = 'medium';
    if (confRaw === 'low' || confRaw === 'none') confidence = confRaw;
    else confidence = 'medium'; // cap paid at medium (never high)

    return { email: raw, confidence };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function alreadyEnriched(lead: LocalLead): boolean {
  const email = lead.ownerEmail?.trim();
  const conf = lead.emailConfidence;
  if (email && conf && conf !== 'none') return true;
  return false;
}

export async function loadLeadsToEnrich(
  opts: EnrichLocalLeadsOptions
): Promise<{ leads: LocalLead[]; skipped: number }> {
  const db = getAdminDb();
  const col = db.collection(LOCAL_LEADS_COLLECTION);
  const explicitIds = (opts.leadIds ?? []).map((id) => id.trim()).filter(Boolean);
  const limit = clampLimit(opts.limit);
  const statuses =
    opts.statuses && opts.statuses.length > 0 ? opts.statuses : DEFAULT_STATUSES;

  let skipped = 0;
  const leads: LocalLead[] = [];

  if (explicitIds.length > 0) {
    // Explicit IDs: enrich even if already enriched; still respect limit
    const ids = explicitIds.slice(0, limit);
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const snaps = await db.getAll(...chunk.map((id) => col.doc(id)));
      for (const snap of snaps) {
        if (!snap.exists) {
          skipped += 1;
          continue;
        }
        leads.push({ id: snap.id, ...(snap.data() as Omit<LocalLead, 'id'>) });
      }
    }
    return { leads, skipped };
  }

  // Prefer missing ownerEmail / confidence none
  const snap = await col.where('status', 'in', statuses.slice(0, 10)).limit(200).get();
  const candidates = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<LocalLead, 'id'>),
  }));

  candidates.sort((a, b) => {
    const aNeed = alreadyEnriched(a) ? 1 : 0;
    const bNeed = alreadyEnriched(b) ? 1 : 0;
    if (aNeed !== bNeed) return aNeed - bNeed;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  for (const lead of candidates) {
    if (leads.length >= limit) break;
    if (alreadyEnriched(lead)) {
      skipped += 1;
      continue;
    }
    leads.push(lead);
  }

  return { leads, skipped };
}

async function persistEnrich(
  id: string,
  patch: {
    ownerEmail: string | null;
    emailConfidence: LocalLeadEmailConfidence;
    enrichSource: LocalLeadEnrichSource;
    enrichError: string | null;
  }
): Promise<void> {
  const db = getAdminDb();
  await db
    .collection(LOCAL_LEADS_COLLECTION)
    .doc(id)
    .set(
      {
        ownerEmail: patch.ownerEmail,
        emailConfidence: patch.emailConfidence,
        enrichSource: patch.enrichSource,
        enrichError: patch.enrichError,
        enrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/**
 * Owner-email enrich pipeline. Does NOT send email (Attach HOLD).
 */
export async function enrichLocalLeads(
  opts: EnrichLocalLeadsOptions = {}
): Promise<LocalLeadsEnrichSummary> {
  const { leads, skipped: preSkipped } = await loadLeadsToEnrich(opts);
  let enriched = 0;
  let skipped = preSkipped;
  let failed = 0;
  const results: LocalLeadEnrichResultItem[] = [];

  for (let i = 0; i < leads.length; i++) {
    if (i > 0) await sleep(FETCH_GAP_MS);
    const lead = leads[i]!;
    const id = lead.id;
    if (!id) {
      skipped += 1;
      continue;
    }

    try {
      const signal = lead.websiteSignal;
      let hit: ScrapeHit | null = null;
      let scrapeError: string | undefined;

      if (signal === 'none' || signal === 'facebook_only') {
        scrapeError = `skip_scrape_${signal}`;
      } else if (!lead.websiteUrl?.trim()) {
        scrapeError = 'no_website_url';
      } else {
        const scraped = await scrapeWebsiteEmails(lead.websiteUrl);
        hit = scraped.hit;
        scrapeError = scraped.error;
      }

      if (!hit) {
        const apiHit = await tryEnrichmentApi(lead);
        if (apiHit) {
          hit = {
            email: apiHit.email,
            confidence: apiHit.confidence,
            source: 'enrichment_api',
          };
        }
      }

      if (!hit) {
        const patch = {
          ownerEmail: lead.ownerEmail ?? null,
          emailConfidence: 'none' as const,
          enrichSource: 'none' as const,
          enrichError: scrapeError ?? 'no_email_found',
        };
        await persistEnrich(id, patch);
        failed += 1;
        results.push({
          id,
          ownerEmail: patch.ownerEmail,
          emailConfidence: patch.emailConfidence,
          enrichSource: patch.enrichSource,
          enrichError: patch.enrichError,
        });
        continue;
      }

      const patch = {
        ownerEmail: hit.email,
        emailConfidence: hit.confidence,
        enrichSource: hit.source,
        enrichError: null as string | null,
      };
      await persistEnrich(id, patch);
      enriched += 1;
      results.push({
        id,
        ownerEmail: patch.ownerEmail,
        emailConfidence: patch.emailConfidence,
        enrichSource: patch.enrichSource,
        enrichError: null,
      });
    } catch (err: any) {
      failed += 1;
      const msg = err?.message ? String(err.message).slice(0, 200) : 'enrich_failed';
      try {
        await persistEnrich(id, {
          ownerEmail: lead.ownerEmail ?? null,
          emailConfidence: 'none',
          enrichSource: 'none',
          enrichError: msg,
        });
      } catch {
        // ignore persist failure on error path
      }
      results.push({
        id,
        ownerEmail: lead.ownerEmail ?? null,
        emailConfidence: 'none',
        enrichSource: 'none',
        enrichError: msg,
      });
    }
  }

  return { enriched, skipped, failed, results };
}
