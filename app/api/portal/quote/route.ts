import { NextRequest, NextResponse } from 'next/server';
import { decidePortalQuote } from '@/lib/portal';
import { AdminNotConfiguredError } from '@/lib/firebase-admin';

/**
 * A client accepting or declining a quote from their share link.
 *
 * Ownership and state are enforced in decidePortalQuote against the Admin SDK.
 * Every rejection is reported as a 404: from outside, a bad token, someone
 * else's quote, and an already-decided quote must look identical.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; quoteId?: string; decision?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const { token, quoteId, decision } = body;

  if (!token || !quoteId || (decision !== 'accepted' && decision !== 'rejected')) {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  try {
    const result = await decidePortalQuote(token, quoteId, decision);

    if (!result.ok) {
      return NextResponse.json({ error: 'That quote is no longer available.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: decision });
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      console.error('Portal quote decision attempted without Admin credentials.');
      return NextResponse.json(
        { error: 'The portal is temporarily unavailable. Please contact us directly.' },
        { status: 503 }
      );
    }
    console.error('portal quote decision failed:', error);
    return NextResponse.json({ error: 'Could not record your decision.' }, { status: 500 });
  }
}
