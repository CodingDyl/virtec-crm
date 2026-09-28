import 'server-only';
import type { CleanInboundLead } from '@/lib/inbound-leads';
import type { InboundLeadTrack } from '@/types/inbound-lead';

/**
 * An email to the team when a website lead arrives.
 *
 * Optional: sent only when `INBOUND_NOTIFY_EMAIL` and `RESEND_API_KEY` are
 * set. Failure never fails the lead, which is already saved. Every value a
 * visitor typed is HTML-escaped, and the visitor's address goes in
 * `reply_to`, never `from`, so the mail cannot be used to impersonate anyone.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export async function notifyInboundLead(track: InboundLeadTrack, lead: CleanInboundLead, id: string): Promise<void> {
  const to = process.env.INBOUND_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;

  const rows: [string, string | undefined][] = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Company', lead.company],
    ['Website', lead.website],
    ...Object.entries(lead.details),
    ['Page', lead.page],
    ['Lead id', id],
  ];
  const present = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const site = track === 'jurivo' ? 'Jurivo' : 'Virtara';
  const subject = `New ${site} lead (${lead.source}): ${lead.name}`.replace(/[\r\n]+/g, ' ').slice(0, 150);

  const html = [
    `<h2>New ${site} lead: ${escapeHtml(lead.source)}</h2>`,
    '<table cellpadding="4">',
    ...present.map(([label, value]) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`),
    '</table>',
    lead.message ? `<p style="white-space:pre-wrap">${escapeHtml(lead.message)}</p>` : '',
  ].join('');
  const text = [...present.map(([label, value]) => `${label}: ${value}`), '', lead.message ?? ''].join('\n');

  try {
    const { Resend } = await import('resend');
    const result = await new Resend(apiKey).emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: to.split(',').map((address) => address.trim()).filter(Boolean),
      replyTo: lead.email,
      subject,
      html,
      text,
    });
    if (result.error) console.error('Inbound lead notification failed:', result.error.message);
  } catch (error) {
    console.error('Inbound lead notification failed:', error);
  }
}
