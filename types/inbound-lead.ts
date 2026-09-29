/**
 * A lead that came in through one of our own websites (Virtara, Jurivo).
 *
 * Kept apart from `localLeads` on purpose: a local lead is a business found by
 * a Places scan, with a place id and a score. An inbound lead is a person who
 * filled in a form. Different source, different fields, different first move
 * (reply, not research).
 */

export const INBOUND_LEADS_COLLECTION = 'inbound_leads';

export type InboundLeadTrack = 'virtara' | 'jurivo';

export const INBOUND_LEAD_STATUSES = ['new', 'reviewing', 'replied', 'won', 'not_a_fit', 'spam'] as const;
export type InboundLeadStatus = (typeof INBOUND_LEAD_STATUSES)[number];

/** Which form on the site. The site says; Virtec only checks the shape. */
export const INBOUND_LEAD_SOURCES = [
  'start-a-project',
  'contact',
  'seo',
  'starter',
  'professional',
  'enterprise',
  'health-check',
  'audit',
  'demo-request',
] as const;

/**
 * A lead magnet's signups come in as `magnet-<slug>`, one source per magnet,
 * so each can be counted on its own. New magnets need no change here.
 */
export const LEAD_MAGNET_SOURCE = /^magnet-[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function isInboundLeadSource(source: string): boolean {
  return (INBOUND_LEAD_SOURCES as readonly string[]).includes(source) || LEAD_MAGNET_SOURCE.test(source);
}

export interface InboundLead {
  id: string;
  track: InboundLeadTrack;
  source: string;
  status: InboundLeadStatus;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  message?: string;
  /** Form-specific answers, e.g. `{ budget: "R 25 000", practiceArea: "Family law" }`. */
  details: Record<string, string>;
  consent: boolean;
  utm?: { source?: string; medium?: string; campaign?: string };
  /** Path the form was on, e.g. `/start-a-project`. */
  page?: string;
  /** When the lead magnet's email went out, for magnet signups. */
  nurtureSentAt?: unknown;
  nurtureError?: string;
  /** The email was held back on purpose (an address that already got its daily limit). */
  nurtureSkipped?: string;
  createdAt: unknown;
  updatedAt: unknown;
}
