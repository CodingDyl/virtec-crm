import 'server-only';
import { NextRequest } from 'next/server';
import { sameSecret } from '@/lib/agentos-auth';
import type { InboundLeadTrack } from '@/types/inbound-lead';

/**
 * Which website is posting a lead, decided by its key.
 *
 * Each site has its own key, and the key alone sets the lead's track: a site
 * cannot claim to be the other one, and a leaked Jurivo key can be rotated
 * without touching Virtara. These keys only create inbound leads. They must
 * differ from each other and from both AgentOS keys, or the route refuses to
 * run, since sharing one would let a website key read or change CRM data.
 */

const SITE_KEYS: { track: InboundLeadTrack; env: string }[] = [
  { track: 'virtara', env: 'VIRTARA_SITE_LEADS_KEY' },
  { track: 'jurivo', env: 'JURIVO_SITE_LEADS_KEY' },
];

export type SiteAuth =
  | { ok: true; track: InboundLeadTrack }
  | { ok: false; status: 401 | 503; error: string };

function configured(): { track: InboundLeadTrack; key: string }[] | string {
  const sites = SITE_KEYS.flatMap(({ track, env }) => {
    const key = process.env[env];
    return key ? [{ track, key }] : [];
  });
  if (sites.length === 0) return 'No website lead keys are configured on this deployment';

  const others = [process.env.AGENTOS_API_KEY, process.env.AGENTOS_WRITE_API_KEY].filter((key): key is string => Boolean(key));
  for (const [index, site] of sites.entries()) {
    if (site.key.length < 24) return `${site.track} lead key is too short (24 characters minimum)`;
    if (others.some((other) => sameSecret(site.key, other))) return `${site.track} lead key must differ from the AgentOS keys`;
    if (sites.slice(index + 1).some((other) => sameSecret(site.key, other.key))) return 'Each website needs its own lead key';
  }
  return sites;
}

export function verifySiteKey(request: NextRequest): SiteAuth {
  const sites = configured();
  if (typeof sites === 'string') {
    console.error(`Inbound leads: ${sites}`);
    return { ok: false, status: 503, error: 'Inbound leads are not configured on this deployment' };
  }

  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'Missing or malformed Authorization header' };

  // Compare against every key, not just until the first match, so timing
  // does not reveal which site a guess was closest to.
  let track: InboundLeadTrack | undefined;
  for (const site of sites) {
    if (sameSecret(match[1], site.key)) track = site.track;
  }
  return track ? { ok: true, track } : { ok: false, status: 401, error: 'Invalid key' };
}
