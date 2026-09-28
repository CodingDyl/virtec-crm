import 'server-only';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * What every AgentOS write route shares.
 *
 * The write surface is deliberately tiny: two PATCH routes, each allowed to
 * change one or two named fields. Everything else a route might be tempted to
 * accept is refused by construction — a body is read field by field, never
 * spread into a document.
 */

/** Firestore auto-ids, and anything similar. Never a path. */
const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isDocId(value: unknown): value is string {
  return typeof value === 'string' && DOC_ID.test(value);
}

/**
 * The collection AgentOS writes are recorded in.
 *
 * Written only through the Admin SDK. `firestore.rules` names no rule for it,
 * so the catch-all deny keeps it unreadable and unwritable from any browser.
 */
export const AGENTOS_AUDIT_COLLECTION = 'agentos_audit';

export interface AgentOSAuditEntry {
  route: string;
  collection: string;
  docId: string;
  /** Only the fields the write touched, before and after. */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * Records one write inside the same transaction as the write itself, so the
 * audit trail can never disagree with the data: either both land or neither.
 */
export function recordAudit(transaction: Transaction, entry: AgentOSAuditEntry): void {
  const ref = getAdminDb().collection(AGENTOS_AUDIT_COLLECTION).doc();
  transaction.set(ref, {
    ...entry,
    actor: 'agentos',
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * A small per-instance rate limit.
 *
 * Honest about its reach: serverless instances do not share memory, so this
 * bounds a runaway loop hitting one warm instance, not a determined attacker
 * across many. The real control is the write key; this stops AgentOS itself
 * from hammering the CRM if something goes wrong on its side.
 */
const WINDOW_MS = 60_000;
const MAX_WRITES_PER_WINDOW = 30;
let windowStart = 0;
let writesInWindow = 0;

export function takeWriteSlot(now = Date.now()): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    writesInWindow = 0;
  }
  if (writesInWindow >= MAX_WRITES_PER_WINDOW) return false;
  writesInWindow += 1;
  return true;
}

/** The request body as a plain object, or undefined if it is anything else. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Refuses any field outside the allow-list, so a typo or an extra field is an error, not silently ignored. */
export function unexpectedFields(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body).filter((key) => !allowed.includes(key));
}

export class WriteConflict extends Error {}
export class WriteNotFound extends Error {}
