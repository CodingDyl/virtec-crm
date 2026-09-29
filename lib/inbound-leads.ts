import { createHash } from 'node:crypto';
import { isPlausibleEmail } from '@/lib/email-address';
import { INBOUND_LEAD_SOURCES, isInboundLeadSource, type InboundLeadTrack } from '@/types/inbound-lead';

/**
 * Validation for leads posted by our websites.
 *
 * The body is read field by field against an allow-list and never spread into
 * a document, so a site (or anyone holding its key) cannot set `status`,
 * `track`, timestamps or any field we did not name. Everything is trimmed,
 * length-capped and stored as plain text: nothing here is ever rendered as
 * HTML.
 */

export interface CleanInboundLead {
  source: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  message?: string;
  details: Record<string, string>;
  consent: boolean;
  utm?: { source?: string; medium?: string; campaign?: string };
  page?: string;
}

const ALLOWED = ['source', 'name', 'email', 'phone', 'company', 'website', 'message', 'details', 'consent', 'utm', 'page'];
const DETAIL_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const MAX_DETAILS = 12;

/** Control characters out (keeping newlines and tabs), whitespace trimmed. */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function text(body: Record<string, unknown>, key: string, max: number, errors: string[]): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    errors.push(`${key} must be a string`);
    return undefined;
  }
  const cleaned = clean(value);
  if (cleaned.length > max) {
    errors.push(`${key} is longer than ${max} characters`);
    return undefined;
  }
  return cleaned || undefined;
}

export function validateInboundLead(body: Record<string, unknown>): { lead?: CleanInboundLead; errors: string[] } {
  const errors: string[] = [];

  const extra = Object.keys(body).filter((key) => !ALLOWED.includes(key));
  if (extra.length > 0) errors.push(`Unexpected fields: ${extra.join(', ')}`);

  const source = text(body, 'source', 40, errors);
  if (!source || !isInboundLeadSource(source)) {
    errors.push(`source must be one of: ${INBOUND_LEAD_SOURCES.join(', ')}, or magnet-<slug>`);
  }

  const name = text(body, 'name', 120, errors);
  if (!name) errors.push('name is required');

  const email = text(body, 'email', 254, errors)?.toLowerCase();
  if (!email || !isPlausibleEmail(email)) errors.push('email must be a valid address');

  let website = text(body, 'website', 300, errors);
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    try {
      const url = new URL(website);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
      website = url.toString();
    } catch {
      errors.push('website must be a web address');
      website = undefined;
    }
  }

  const details: Record<string, string> = {};
  if (body.details !== undefined && body.details !== null) {
    if (typeof body.details !== 'object' || Array.isArray(body.details)) {
      errors.push('details must be an object of short text answers');
    } else {
      const entries = Object.entries(body.details as Record<string, unknown>);
      if (entries.length > MAX_DETAILS) errors.push(`details holds at most ${MAX_DETAILS} answers`);
      for (const [key, value] of entries.slice(0, MAX_DETAILS)) {
        if (!DETAIL_KEY.test(key)) {
          errors.push(`details key "${key.slice(0, 40)}" is not allowed`);
          continue;
        }
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          errors.push(`details.${key} must be text`);
          continue;
        }
        const cleaned = clean(String(value));
        if (cleaned.length > 300) errors.push(`details.${key} is longer than 300 characters`);
        else if (cleaned) details[key] = cleaned;
      }
    }
  }

  let utm: CleanInboundLead['utm'];
  if (body.utm !== undefined && body.utm !== null) {
    if (typeof body.utm !== 'object' || Array.isArray(body.utm)) {
      errors.push('utm must be an object');
    } else {
      const raw = body.utm as Record<string, unknown>;
      const picked = {
        source: text(raw, 'source', 100, errors),
        medium: text(raw, 'medium', 100, errors),
        campaign: text(raw, 'campaign', 100, errors),
      };
      const kept = Object.fromEntries(Object.entries(picked).filter(([, value]) => value !== undefined));
      if (Object.keys(kept).length > 0) utm = kept;
    }
  }

  if (body.consent !== undefined && typeof body.consent !== 'boolean') errors.push('consent must be true or false');

  const lead: CleanInboundLead = {
    source: source ?? '',
    name: name ?? '',
    email: email ?? '',
    phone: text(body, 'phone', 40, errors),
    company: text(body, 'company', 160, errors),
    website,
    message: text(body, 'message', 4000, errors),
    details,
    consent: body.consent === true,
    utm,
    page: text(body, 'page', 200, errors),
  };

  return errors.length > 0 ? { errors } : { lead, errors };
}

/**
 * The same person sending the same form twice (a double click, a refresh)
 * gives the same key. Stored on the lead, so finding a duplicate is a
 * single-field query that needs no composite index.
 */
export function inboundDedupeKey(track: InboundLeadTrack, email: string, source: string): string {
  return createHash('sha256').update(`${track}|${email.toLowerCase()}|${source}`).digest('hex').slice(0, 32);
}

/** Firestore wants no `undefined` values. */
export function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
