/** Email extraction helpers for local-leads owner-email enrich. */

export type ExtractedEmail = {
  email: string;
  domain: string;
  fromMailto: boolean;
  isFreeMail: boolean;
};

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.za',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
]);

const EMAIL_RE =
  /[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi;

const MAILTO_RE = /mailto:([^"'?\s#>]+)/gi;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/^mailto:/i, '').split('?')[0]!.trim();
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  // Basic RFC-ish check; reject obvious junk from HTML parsing
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!domain.includes('.')) return false;
  if (/^(example|test|domain|email|yourname|name|user)\./i.test(domain)) return false;
  if (/^(noreply|no-reply|donotreply|do-not-reply)@/i.test(email)) return false;
  return /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
    email
  );
}

export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}

/** Hostname of the business website, without www. */
export function businessHostFromWebsiteUrl(websiteUrl?: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    const u = new URL(websiteUrl.includes('://') ? websiteUrl : `https://${websiteUrl}`);
    return u.hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function domainOf(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export function extractEmailsFromHtml(html: string): ExtractedEmail[] {
  const byEmail = new Map<string, ExtractedEmail>();

  const consider = (raw: string, fromMailto: boolean) => {
    const email = normalizeEmail(raw);
    if (!isValidEmail(email)) return;
    const domain = domainOf(email);
    const existing = byEmail.get(email);
    if (existing) {
      if (fromMailto && !existing.fromMailto) {
        byEmail.set(email, { ...existing, fromMailto: true });
      }
      return;
    }
    byEmail.set(email, {
      email,
      domain,
      fromMailto,
      isFreeMail: isFreeMailDomain(domain),
    });
  };

  let m: RegExpExecArray | null;
  MAILTO_RE.lastIndex = 0;
  while ((m = MAILTO_RE.exec(html)) !== null) {
    consider(decodeURIComponent(m[1] ?? ''), true);
  }

  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(html)) !== null) {
    consider(m[0] ?? '', false);
  }

  return Array.from(byEmail.values());
}

/**
 * Rank prefer: business-domain + mailto + contact page signals.
 * Higher score = better.
 */
export function rankEmails(
  emails: ExtractedEmail[],
  businessHost: string | null,
  opts?: { fromContactPage?: boolean }
): ExtractedEmail[] {
  const fromContactPage = opts?.fromContactPage ?? false;
  const scored = emails.map((e) => {
    let score = 0;
    if (businessHost && (e.domain === businessHost || e.domain.endsWith(`.${businessHost}`))) {
      score += 100;
    }
    if (e.fromMailto) score += 40;
    if (fromContactPage) score += 20;
    if (!e.isFreeMail) score += 15;
    else score -= 10;
    // Prefer info@ / contact@ / hello@ / sales@ lightly over random
    const local = e.email.split('@')[0] ?? '';
    if (/^(info|contact|hello|sales|enquiries|enquiry|office|admin)$/i.test(local)) {
      score += 8;
    }
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score || a.e.email.localeCompare(b.e.email));
  return scored.map((s) => s.e);
}
