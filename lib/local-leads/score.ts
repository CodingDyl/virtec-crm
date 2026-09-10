import type {
  LocalLeadScoreInput,
  LocalLeadScoreResult,
  WebsiteSignal,
} from '@/types/local-lead';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePhone(value?: string | null): string {
  return (value ?? '').replace(/\D+/g, '');
}

export type CustomerMatchShape = {
  companyName?: string | null;
  name?: string | null;
  contactNumber?: string | null;
  phone?: string | null;
};

/**
 * Desk scoring rules (locked):
 * +40 none, +30 facebook_only, +20 weak, -25 ok, -100 existing customer.
 */
export function scoreLocalLead(input: LocalLeadScoreInput): LocalLeadScoreResult {
  let score = 0;
  const scoreReasons: string[] = [];

  switch (input.websiteSignal as WebsiteSignal) {
    case 'none':
      score += 40;
      scoreReasons.push('No website');
      break;
    case 'facebook_only':
      score += 30;
      scoreReasons.push('Facebook/social only');
      break;
    case 'weak':
      score += 20;
      scoreReasons.push('Weak website');
      break;
    case 'ok':
      score -= 25;
      scoreReasons.push('Strong website');
      break;
    default:
      break;
  }

  if (input.matchesExistingCustomer) {
    score -= 100;
    scoreReasons.push('Existing customer');
  }

  return { score: clamp(score, 0, 100), scoreReasons };
}

export function matchesExistingCustomer(
  lead: { name?: string | null; phone?: string | null },
  customers: CustomerMatchShape[]
): boolean {
  const leadName = normalizeText(lead.name);
  const leadPhone = normalizePhone(lead.phone);

  for (const customer of customers) {
    const company = normalizeText(customer.companyName);
    const name = normalizeText(customer.name);
    const phone = normalizePhone(customer.contactNumber ?? customer.phone);

    if (leadName && (leadName === company || leadName === name)) return true;
    if (
      leadPhone &&
      phone &&
      leadPhone.length >= 7 &&
      phone.length >= 7 &&
      (leadPhone.endsWith(phone.slice(-7)) || phone.endsWith(leadPhone.slice(-7)))
    ) {
      return true;
    }
  }
  return false;
}
