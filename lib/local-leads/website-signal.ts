import type { WebsiteSignal } from '@/types/local-lead';

const SOCIAL_HOSTS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'm.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'www.facebook.com',
];

const WEAK_HOSTS = [
  'wixsite.com',
  'squarespace.com',
  'weebly.com',
  'sites.google.com',
  'linktr.ee',
  'bit.ly',
];

function hostnameOf(url: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, needles: string[]): boolean {
  return needles.some((n) => host === n || host.endsWith(`.${n}`));
}

/**
 * Classify a Places websiteUri for lead scoring.
 * Instagram is treated as social-only → facebook_only (Desk enum lock).
 */
export function detectWebsiteSignal(websiteUrl?: string | null): WebsiteSignal {
  if (!websiteUrl || !websiteUrl.trim()) return 'none';

  const raw = websiteUrl.trim();
  const host = hostnameOf(raw);
  if (!host) return 'unknown';

  if (hostMatches(host, SOCIAL_HOSTS)) return 'facebook_only';
  if (hostMatches(host, WEAK_HOSTS)) return 'weak';

  const isHttpOnly = /^http:\/\//i.test(raw);
  if (isHttpOnly) return 'weak';

  return 'ok';
}

export function hasWebsiteFromSignal(signal: WebsiteSignal): boolean {
  return signal !== 'none';
}
