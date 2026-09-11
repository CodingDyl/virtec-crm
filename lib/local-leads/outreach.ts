import type { LocalLead, LocalLeadOutreachTemplateId } from '@/types/local-lead';

/** Locked SA cold-lead build bands (ex VAT) — Virtara SMB. */
export const SA_BUILD_BANDS = {
  starter: 'Starter site R12k–R18k',
  standard: 'Standard site R22k–R35k',
  ecom: 'E-com lite R35k–R55k',
} as const;

export type OutreachTemplate = {
  id: LocalLeadOutreachTemplateId;
  label: string;
  subject: string;
  body: string;
};

function priceHint(lead: LocalLead): string {
  const cat = (lead.category || '').toLowerCase();
  if (cat.includes('shop') || cat.includes('store') || cat.includes('retail')) {
    return SA_BUILD_BANDS.ecom;
  }
  if (lead.websiteSignal === 'none' || lead.websiteSignal === 'facebook_only') {
    return SA_BUILD_BANDS.starter;
  }
  return SA_BUILD_BANDS.standard;
}

export function renderOutreachTemplate(
  id: LocalLeadOutreachTemplateId,
  lead: LocalLead
): OutreachTemplate {
  const name = lead.name || 'there';
  const area = lead.area || lead.suburb || 'Sandton';
  const category = lead.category || 'business';
  const band = priceHint(lead);
  const care =
    lead.track === 'jurivo'
      ? 'We also run Jurivo for law firms that need a sharper web + intake presence.'
      : 'After launch we offer Care (hosting + maintenance) or Bundle (+ SEO) so the site stays live and findable.';

  if (id === 'o1') {
    return {
      id,
      label: 'Outreach 1 — first touch',
      subject: `${name} — quick idea for your ${category} web presence`,
      body: `Hi ${name} team,

I came across your ${category} business in ${area} and noticed your online presence could work harder for you (weak/no dedicated site is common — and fixable).

Virtara builds clean, mobile-first sites for SA SMEs. For a business like yours we usually land around: ${band} (ex VAT), with a 40–50% deposit to start.

${care}

Worth a 15-minute chat this week?

Dylan
Virtara`,
    };
  }

  if (id === 'o2') {
    return {
      id,
      label: 'Outreach 2 — day 3 follow-up',
      subject: `Re: ${name} — still open to a quick site chat?`,
      body: `Hi again — just bumping this in case it got buried.

Happy to send 2–3 relevant SA examples and a ballpark for ${name} (${band}). No pitch deck marathon — just a clear next step if useful.

Dylan
Virtara`,
    };
  }

  return {
    id,
    label: 'Outreach 3 — week follow-up',
    subject: `Last note — ${name} web presence`,
    body: `Hi — last follow-up from me so I’m not noise in your inbox.

If a refreshed site (or Care retainer after build) is on your radar later this year, reply “later” and I’ll check in then. Otherwise I’ll close the loop.

Typical range for ${category} in ${area}: ${band}.

Dylan
Virtara`,
  };
}

/** Add n business days (Mon–Fri) to a start date. */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start.getTime());
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type OutreachDue = {
  next: LocalLeadOutreachTemplateId | null;
  label: string;
  overdue: boolean;
};

/** O2 due 3 business days after O1; O3 due 7 calendar days after O1. */
export function getOutreachDue(lead: LocalLead, now = new Date()): OutreachDue {
  const stage = lead.outreachStage ?? 'none';
  if (stage === 'replied' || stage === 'stopped') {
    return { next: null, label: stage, overdue: false };
  }

  const o1 = asDate(lead.outreach1SentAt);
  if (!o1) {
    return { next: 'o1', label: 'Ready for O1', overdue: false };
  }

  const o2At = addBusinessDays(o1, 3);
  const o3At = new Date(o1.getTime());
  o3At.setDate(o3At.getDate() + 7);

  if (!lead.outreach2SentAt && now >= o2At && stage !== 'o2' && stage !== 'o3') {
    return { next: 'o2', label: 'O2 due', overdue: now > o2At };
  }
  if (!lead.outreach2SentAt && now < o2At) {
    return { next: null, label: `O2 on ${o2At.toLocaleDateString('en-ZA')}`, overdue: false };
  }
  if (!lead.outreach3SentAt && now >= o3At) {
    return { next: 'o3', label: 'O3 due', overdue: now > o3At };
  }
  if (!lead.outreach3SentAt && lead.outreach2SentAt) {
    return { next: null, label: `O3 on ${o3At.toLocaleDateString('en-ZA')}`, overdue: false };
  }
  if (lead.outreach3SentAt) {
    return { next: null, label: 'Sequence complete', overdue: false };
  }
  return { next: null, label: `Stage ${stage}`, overdue: false };
}
