import { Product, ProductRelease, STAGES_THAT_GO_STALE, STALE_AFTER_DAYS } from '@/types/product';
import { toDate } from '@/lib/firestore-schema';

/**
 * When a product was last worked on: the later of its own last edit and its
 * most recent release. Returns null for a product with neither, which only
 * happens between creation and the first write.
 */
export function lastTouched(product: Product, releases: ProductRelease[]): Date | null {
  const candidates = [
    toDate(product.updatedAt),
    toDate(product.createdAt),
    ...releases.map((r) => toDate(r.shippedAt)),
  ].filter((d): d is Date => d !== null);

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

export function daysSince(date: Date, from: Date = new Date()): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(from) - startOfDay(date)) / 86_400_000);
}

/**
 * Whether a product has gone quiet in a way worth noticing.
 *
 * An idea sitting untouched for months is not a problem — that is what an idea
 * list is for. A prototype, beta or live product going silent is the thing this
 * page exists to surface.
 */
export function isGoingQuiet(product: Product, touched: Date | null): boolean {
  if (!STAGES_THAT_GO_STALE.includes(product.stage)) return false;
  if (!touched) return false;
  return daysSince(touched) >= STALE_AFTER_DAYS;
}

/** "today" / "yesterday" / "3 weeks ago" — short enough to sit in a list row. */
export function relativeDay(date: Date | null): string {
  if (!date) return 'never';
  const days = daysSince(date);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

/** Normalise a pasted URL so a bare domain still links correctly. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** A short label for a URL, used when the user does not supply one. */
export function labelFromUrl(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}
