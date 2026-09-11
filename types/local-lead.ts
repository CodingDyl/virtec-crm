/** Locked Local Lead schema (Desk) — shared by FE + Places ingest. */

export type LocalLeadTrack = 'virtara' | 'jurivo';

export type LocalLeadWebsiteSignal =
  | 'none'
  | 'facebook_only'
  | 'weak'
  | 'ok'
  | 'unknown';

/** Alias used by ingest / scoring modules. */
export type WebsiteSignal = LocalLeadWebsiteSignal;

export type LocalLeadStatus =
  | 'new'
  | 'reviewing'
  | 'qualified'
  | 'disqualified'
  | 'converted';

export type LocalLeadEmailConfidence = 'high' | 'medium' | 'low' | 'none';

export type LocalLeadEnrichSource =
  | 'website_mailto'
  | 'website_contact_page'
  | 'enrichment_api'
  | 'none';

export type LocalLeadOutreachStage =
  | 'none'
  | 'o1'
  | 'o2'
  | 'o3'
  | 'replied'
  | 'stopped';

export type LocalLeadOutreachTemplateId = 'o1' | 'o2' | 'o3';

export interface LocalLead {
  id?: string;
  googlePlaceId: string;
  name: string;
  phone?: string;
  websiteUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
  category: string;
  primaryType?: string;
  track: LocalLeadTrack;
  area: string;
  suburb?: string;
  websiteSignal: LocalLeadWebsiteSignal;
  hasWebsite?: boolean;
  rating?: number;
  reviewCount?: number;
  score: number;
  scoreReasons: string[];
  status: LocalLeadStatus;
  customerId?: string;
  source: string;
  lastFetchedAt: any;
  createdAt: any;
  updatedAt: any;
  scanRunId?: string;
  notes?: string;
  /** Owner / decision-maker email from enrich (no auto-send). */
  ownerEmail?: string | null;
  emailConfidence?: LocalLeadEmailConfidence;
  enrichedAt?: any;
  enrichSource?: LocalLeadEnrichSource;
  enrichError?: string | null;
  outreachStage?: LocalLeadOutreachStage;
  outreach1SentAt?: any;
  outreach2SentAt?: any;
  outreach3SentAt?: any;
  outreachRepliedAt?: any;
  selectedTemplateId?: LocalLeadOutreachTemplateId;
}

export const LOCAL_LEADS_COLLECTION = 'localLeads';

export const LOCAL_LEAD_STATUSES: LocalLeadStatus[] = [
  'new',
  'reviewing',
  'qualified',
  'disqualified',
  'converted',
];

export const LOCAL_LEAD_TRACKS: LocalLeadTrack[] = ['virtara', 'jurivo'];

export const LOCAL_LEAD_EMAIL_CONFIDENCES: LocalLeadEmailConfidence[] = [
  'high',
  'medium',
  'low',
  'none',
];

export const LOCAL_LEAD_ENRICH_SOURCES: LocalLeadEnrichSource[] = [
  'website_mailto',
  'website_contact_page',
  'enrichment_api',
  'none',
];

export const LOCAL_LEAD_OUTREACH_STAGES: LocalLeadOutreachStage[] = [
  'none',
  'o1',
  'o2',
  'o3',
  'replied',
  'stopped',
];

export type LocalLeadScoreBand = 'all' | 'hot' | 'warm' | 'cold';

export type LocalLeadScoreInput = {
  websiteSignal: WebsiteSignal;
  matchesExistingCustomer?: boolean;
};

export type LocalLeadScoreResult = {
  score: number;
  scoreReasons: string[];
};

export type LocalLeadsScanSummary = {
  scanRunId: string;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
  byCategory: Record<string, { fetched: number; upserted: number }>;
  track: LocalLeadTrack | 'all';
  status?: string;
  message?: string;
};

export type LocalLeadEnrichResultItem = {
  id: string;
  ownerEmail: string | null;
  emailConfidence: LocalLeadEmailConfidence;
  enrichSource: LocalLeadEnrichSource;
  enrichError?: string | null;
};

export type LocalLeadsEnrichSummary = {
  enriched: number;
  skipped: number;
  failed: number;
  results: LocalLeadEnrichResultItem[];
};
