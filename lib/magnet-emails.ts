import 'server-only';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { CleanInboundLead } from '@/lib/inbound-leads';
import type { InboundLeadTrack } from '@/types/inbound-lead';

/**
 * The email a lead magnet signup gets straight away: the link to what they
 * asked for, and one line on what comes next.
 *
 * Each magnet's email is written in AgentOS and published here, one document
 * per slug in `lead_magnet_emails`. That collection is written only through
 * the Admin SDK (its rule is the catch-all deny). When a signup arrives, the
 * inbound route looks up the template by the lead's `magnet-<slug>` source
 * and sends it through Resend.
 *
 * Plain on purpose: text in, text out, with the visitor's first name and the
 * link as the only substitutions. Every value is escaped for the HTML part.
 */

export const MAGNET_EMAILS_COLLECTION = 'lead_magnet_emails';

export interface MagnetEmail {
  track: InboundLeadTrack;
  subject: string;
  /** Plain text. Must contain `{{link}}`; may contain `{{firstName}}`. */
  body: string;
  /** Where the magnet is read, https only. */
  readUrl: string;
  enabled: boolean;
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function isMagnetSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG.test(value);
}

/** The template in a PUT body, field by field, or every problem with it. */
export function validateMagnetEmail(body: Record<string, unknown>): { email?: MagnetEmail; errors: string[] } {
  const errors: string[] = [];
  const extra = Object.keys(body).filter((key) => !['track', 'subject', 'body', 'readUrl', 'enabled'].includes(key));
  if (extra.length > 0) errors.push(`Unexpected fields: ${extra.join(', ')}`);

  const track = body.track;
  if (track !== 'virtara' && track !== 'jurivo') errors.push('track must be virtara or jurivo');

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject || subject.length > 150 || /[\r\n]/.test(subject)) errors.push('subject must be one line, 1 to 150 characters');

  const text = typeof body.body === 'string' ? body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!text || text.length > 3000) errors.push('body must be 1 to 3000 characters');
  else if (!text.includes('{{link}}')) errors.push('body must include {{link}} where the link goes');

  let readUrl = '';
  try {
    const url = new URL(typeof body.readUrl === 'string' ? body.readUrl : '');
    if (url.protocol !== 'https:') throw new Error('not https');
    readUrl = url.toString();
  } catch {
    errors.push('readUrl must be an https address');
  }
  if (readUrl.length > 300) errors.push('readUrl is longer than 300 characters');

  if (typeof body.enabled !== 'boolean') errors.push('enabled must be true or false');

  return errors.length > 0
    ? { errors }
    : { email: { track: track as InboundLeadTrack, subject, body: text, readUrl, enabled: body.enabled as boolean }, errors };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/** The link in the email, marked so the site's read page lets them straight in. */
export function emailLink(readUrl: string): string {
  const url = new URL(readUrl);
  url.searchParams.set('via', 'email');
  return url.toString();
}

/**
 * Their first name, or "there".
 *
 * Only letters, apostrophes and hyphens pass. Anyone can type any address
 * into a form, so the name is the one part of this email a stranger
 * controls; it must not be able to carry a link or a message.
 */
function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}][\p{L}'-]{0,29}$/u.test(first) ? first : 'there';
}

export function renderMagnetEmail(template: MagnetEmail, lead: Pick<CleanInboundLead, 'name'>): { subject: string; text: string; html: string } {
  const link = emailLink(template.readUrl);
  const name = firstName(lead.name);
  const fill = (value: string) => value.replaceAll('{{firstName}}', name);

  const text = fill(template.body).replaceAll('{{link}}', link);
  const html = fill(template.body)
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const parts = paragraph.split('{{link}}').map((part) => escapeHtml(part).replace(/\n/g, '<br>'));
      return `<p>${parts.join(`<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`)}</p>`;
    })
    .join('');

  return { subject: fill(template.subject), text, html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">${html}</div>` };
}

const SENDERS: Record<InboundLeadTrack, { from: string; replyTo: string }> = {
  virtara: { from: 'VIRTARA_FROM_EMAIL', replyTo: 'VIRTARA_REPLY_TO' },
  jurivo: { from: 'JURIVO_FROM_EMAIL', replyTo: 'JURIVO_REPLY_TO' },
};

/**
 * Sends the magnet's email to a new signup, if the magnet has one switched
 * on for this site. The outcome is written onto the lead (`nurtureSentAt`
 * or `nurtureError`) so AgentOS and the dashboard can see it. Never throws:
 * the lead is already saved, and a failed email must not undo that.
 */
export async function sendMagnetEmail(track: InboundLeadTrack, lead: CleanInboundLead, leadRef: DocumentReference): Promise<void> {
  const slug = lead.source.startsWith('magnet-') ? lead.source.slice('magnet-'.length) : undefined;
  if (!slug || !isMagnetSlug(slug)) return;

  const record = async (fields: Record<string, unknown>) => {
    try {
      await leadRef.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
    } catch (error) {
      console.error('Could not record the magnet email outcome:', error);
    }
  };

  try {
    const snapshot = await getAdminDb().collection(MAGNET_EMAILS_COLLECTION).doc(slug).get();
    const template = snapshot.exists ? (snapshot.data() as MagnetEmail) : undefined;
    if (!template || !template.enabled || template.track !== track) return;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env[SENDERS[track].from] || process.env.FROM_EMAIL;
    if (!apiKey || !from) {
      await record({ nurtureError: `Not sent: set RESEND_API_KEY and ${SENDERS[track].from} (or FROM_EMAIL)` });
      return;
    }
    const replyTo = process.env[SENDERS[track].replyTo] || process.env.INBOUND_NOTIFY_EMAIL?.split(',')[0]?.trim();

    const { subject, text, html } = renderMagnetEmail(template, lead);
    const { Resend } = await import('resend');
    const result = await new Resend(apiKey).emails.send({
      from,
      to: [lead.email],
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    });

    if (result.error) {
      console.error('Magnet email failed:', result.error.message);
      await record({ nurtureError: result.error.message.slice(0, 300) });
    } else {
      await record({ nurtureSentAt: FieldValue.serverTimestamp(), nurtureError: FieldValue.delete() });
    }
  } catch (error) {
    console.error('Magnet email failed:', error);
    await record({ nurtureError: 'Sending failed; see the Virtec logs' });
  }
}
