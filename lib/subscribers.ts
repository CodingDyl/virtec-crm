import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { InboundLeadTrack } from '@/types/inbound-lead';

/**
 * The newsletter list (`subscribers`), changed only through the Admin SDK.
 *
 * Firestore rules let only operators touch this collection, so a visitor's
 * browser cannot subscribe or unsubscribe directly: the website's server
 * does it here with its site key. The existing dashboard view reads the same
 * documents (`email`, `name`, `unsubscribed`, `dateSubscribed`); extra fields
 * are ignored by it.
 */

export const SUBSCRIBERS_COLLECTION = 'subscribers';

const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[A-Za-z]{2,24}$/;

export interface SubscriberRequest {
  action: 'subscribe' | 'unsubscribe';
  email: string;
  name?: string;
}

export function validateSubscriberRequest(body: Record<string, unknown>): { request?: SubscriberRequest; errors: string[] } {
  const errors: string[] = [];
  const extra = Object.keys(body).filter((key) => !['action', 'email', 'name'].includes(key));
  if (extra.length > 0) errors.push(`Unexpected fields: ${extra.join(', ')}`);

  if (body.action !== 'subscribe' && body.action !== 'unsubscribe') errors.push('action must be subscribe or unsubscribe');

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL.test(email)) errors.push('email must be a valid address');

  let name: string | undefined;
  if (body.name !== undefined && body.name !== null && body.name !== '') {
    // eslint-disable-next-line no-control-regex
    const cleaned = typeof body.name === 'string' ? body.name.replace(/[\u0000-\u001F\u007F]/g, '').trim() : undefined;
    if (cleaned === undefined || cleaned.length > 120) errors.push('name must be text up to 120 characters');
    else name = cleaned || undefined;
  }

  return errors.length > 0 ? { errors } : { request: { action: body.action as SubscriberRequest['action'], email, name }, errors };
}

/**
 * Applies one request, once and idempotently.
 *
 * Subscribing an address that is already active changes nothing; one that
 * had unsubscribed is switched back on, because the person just asked for it
 * themselves. Unsubscribing an address that is not on the list changes
 * nothing. The caller answers the same either way, so the form cannot be
 * used to find out who is subscribed.
 */
export async function applySubscriberRequest(request: SubscriberRequest, track: InboundLeadTrack): Promise<{ changed: boolean }> {
  const db = getAdminDb();
  const collection = db.collection(SUBSCRIBERS_COLLECTION);

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(collection.where('email', '==', request.email).limit(1));
    const doc = existing.docs[0];

    if (request.action === 'subscribe') {
      if (!doc) {
        transaction.set(collection.doc(), {
          email: request.email,
          name: request.name ?? '',
          unsubscribed: false,
          dateSubscribed: FieldValue.serverTimestamp(),
          track,
          source: 'website',
        });
        return { changed: true };
      }
      if (doc.get('unsubscribed') === true) {
        transaction.update(doc.ref, { unsubscribed: false, resubscribedAt: FieldValue.serverTimestamp() });
        return { changed: true };
      }
      return { changed: false };
    }

    if (doc && doc.get('unsubscribed') !== true) {
      transaction.update(doc.ref, { unsubscribed: true, unsubscribedAt: FieldValue.serverTimestamp() });
      return { changed: true };
    }
    return { changed: false };
  });
}
