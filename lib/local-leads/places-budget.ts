import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * A monthly ceiling on Google Places requests, shared by every scan.
 *
 * Places is billed per request, and the scan sends the contact fields (phone,
 * website), which is Google's dearer tier. Nothing used to limit it, so a
 * few clicks could run up a bill. `PLACES_MONTHLY_REQUEST_CAP` sets the
 * ceiling; the count lives in `places_usage/<YYYY-MM>` (Admin SDK only, no
 * browser rule) and is reserved in a transaction before each request, so two
 * scans at once cannot both spend the last of it.
 *
 * With no cap set the operator's own scan behaves as it always did (usage is
 * still counted, so the number is there when a cap is chosen), and scans
 * started from AgentOS are refused until one is set.
 */

export const PLACES_USAGE_COLLECTION = 'places_usage';

/** The configured ceiling, or undefined when none is set. */
export function placesMonthlyCap(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const value = Number.parseInt(env.PLACES_MONTHLY_REQUEST_CAP ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Calendar month, UTC. Google bills by calendar month, so this is close enough to stay under it. */
export function usageMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Whether `want` more requests fit under the ceiling. No ceiling always fits. */
export function fitsBudget(used: number, want: number, cap: number | undefined): boolean {
  return cap === undefined || used + want <= cap;
}

export interface PlacesBudget {
  month: string;
  used: number;
  cap: number | null;
  remaining: number | null;
}

export function describeBudget(used: number, cap: number | undefined, month: string): PlacesBudget {
  return { month, used, cap: cap ?? null, remaining: cap === undefined ? null : Math.max(0, cap - used) };
}

export async function readPlacesBudget(now: Date = new Date()): Promise<PlacesBudget> {
  const month = usageMonth(now);
  const snapshot = await getAdminDb().collection(PLACES_USAGE_COLLECTION).doc(month).get();
  const used = Number(snapshot.get('requests') ?? 0);
  return describeBudget(Number.isFinite(used) ? used : 0, placesMonthlyCap(), month);
}

/**
 * Takes `want` requests from this month's budget, or refuses.
 *
 * The count goes up before the request is made: a request that then fails
 * is still counted, since Google may bill it and the safe error is to
 * overcount.
 */
export async function reservePlacesRequests(want: number, now: Date = new Date()): Promise<{ ok: boolean; budget: PlacesBudget }> {
  const db = getAdminDb();
  const month = usageMonth(now);
  const cap = placesMonthlyCap();
  const ref = db.collection(PLACES_USAGE_COLLECTION).doc(month);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const used = Number(snapshot.get('requests') ?? 0) || 0;

    if (!fitsBudget(used, want, cap)) return { ok: false, budget: describeBudget(used, cap, month) };

    transaction.set(ref, { month, requests: used + want, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, budget: describeBudget(used + want, cap, month) };
  });
}
