import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleAgentOSAuthError, verifyAgentOSAuth } from '@/lib/agentos-auth';
import { MAGNET_EMAILS_COLLECTION } from '@/lib/magnet-emails';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agentos/lead-magnet-emails
 *
 * Every published lead magnet email: what signups currently receive.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAgentOSAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  try {
    const snapshot = await getAdminDb().collection(MAGNET_EMAILS_COLLECTION).limit(200).get();
    const emails = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        slug: doc.id,
        track: data.track,
        subject: data.subject,
        body: data.body,
        readUrl: data.readUrl,
        enabled: data.enabled === true,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : null,
      };
    });
    return NextResponse.json({ emails, count: emails.length });
  } catch (error) {
    console.error('AgentOS magnet emails API error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead magnet emails' }, { status: 500 });
  }
}
