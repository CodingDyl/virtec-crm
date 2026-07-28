import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { assertQuoteBelongsToToken } from '@/lib/portal';
import { logActivity } from '@/lib/activity';

/**
 * A client accepting or declining a quote from their share link.
 *
 * The token is the only credential, so it is checked here rather than in the
 * browser: it must resolve to an enabled project, and the quote must belong to
 * that project and still be undecided. Anything else is a 404 — a bad token and
 * a quote from someone else's project are indistinguishable from outside.
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

  const owner = await assertQuoteBelongsToToken(token, quoteId);
  if (!owner) {
    return NextResponse.json({ error: 'That quote is no longer available.' }, { status: 404 });
  }

  try {
    await updateDoc(doc(db, 'quotes', quoteId), {
      status: decision,
      decidedAt: serverTimestamp(),
      decidedVia: 'portal',
    });

    // Accepting makes the quote the source of truth for the project amount,
    // exactly as the internal Quotes tab does — otherwise job margin goes stale.
    if (decision === 'accepted') {
      await updateDoc(doc(db, 'projects', owner.projectId), {
        amount: owner.totalAmount,
        quoteId,
      });
    }

    await logActivity(
      'project',
      owner.projectId,
      'quote',
      decision === 'accepted'
        ? `Client accepted a quote from the portal — project amount synced to R${owner.totalAmount.toLocaleString()}`
        : 'Client declined a quote from the portal'
    );

    return NextResponse.json({ ok: true, status: decision });
  } catch (error) {
    console.error('portal quote decision failed:', error);
    return NextResponse.json({ error: 'Could not record your decision.' }, { status: 500 });
  }
}
