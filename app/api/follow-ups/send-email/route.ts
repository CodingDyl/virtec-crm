import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { getOperator } from '@/lib/auth-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FOLLOW_UP_COLLECTION } from '@/lib/follow-ups';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function activityTarget(data: Record<string, any>): { refType: 'project' | 'customer'; refId: string } | null {
  if (data.projectId) return { refType: 'project', refId: data.projectId };
  if (data.customerId) return { refType: 'customer', refId: data.customerId };
  return null;
}

export async function POST(request: NextRequest) {
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const followUpId = typeof body.followUpId === 'string' ? body.followUpId.trim() : '';
    const editedMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!followUpId) {
      return NextResponse.json({ error: 'Missing follow-up id.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection(FOLLOW_UP_COLLECTION).doc(followUpId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Follow-up not found.' }, { status: 404 });
    }

    const followUp = snap.data() ?? {};
    const toEmail = (followUp.customerEmail ?? '').toString().trim();
    if (!EMAIL_REGEX.test(toEmail)) {
      return NextResponse.json({ error: 'Follow-up has no valid recipient email.' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const subject = (followUp.suggestedSubject ?? 'Following up').toString();
    const message = editedMessage || (followUp.suggestedMessage ?? '').toString();
    if (!message) {
      return NextResponse.json({ error: 'Follow-up has no message to send.' }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || '2610dylan@gmail.com';

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject,
      html: message.replace(/\n/g, '<br>'),
      text: message,
    });

    if (error) {
      console.error('follow-up Resend error:', error);
      return NextResponse.json({ error: 'Email sending failed.' }, { status: 502 });
    }

    const batch = db.batch();
    batch.update(ref, {
      status: 'sent',
      lastSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const target = activityTarget(followUp);
    if (target) {
      batch.set(db.collection('activity').doc(), {
        ...target,
        type: 'follow_up',
        message: `Follow-up email sent: ${followUp.reason ?? 'Follow-up'}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      followUpId,
      to: toEmail,
    });
  } catch (error) {
    console.error('follow-up email failed:', error);
    return NextResponse.json(
      { error: 'Failed to send follow-up email.' },
      { status: 500 }
    );
  }
}
