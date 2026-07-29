import { NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';
import { signedReadUrl } from '@/lib/storage-server';

export async function POST(request: NextRequest) {
  try {
    // This route fetches a URL and then sends mail from the business's Resend
    // account. Left open, it is both an outbound-request proxy and a way to
    // send mail as Virtara, so it requires an operator session.
    const operator = await getOperator();
    if (!operator) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
    }

    const body = await request.json();
    const { toEmail, ccEmail, subject, message, invoiceId, invoiceNumber, pdfPath, clientName } = body;

    // Validate required fields
    if (!toEmail || !subject || !message || !pdfPath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Resolved here rather than accepted from the caller, so the server only
    // ever fetches its own storage objects.
    const pdfUrl = await signedReadUrl(pdfPath);
    if (!pdfUrl) {
      return NextResponse.json({ error: 'Invoice PDF not available.' }, { status: 404 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      return NextResponse.json(
        { error: 'Invalid recipient email format' },
        { status: 400 }
      );
    }

    if (ccEmail && !emailRegex.test(ccEmail)) {
      return NextResponse.json(
        { error: 'Invalid CC email format' },
        { status: 400 }
      );
    }

    // Use Resend for email sending
    const { Resend } = require('resend');
    
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Fetch the PDF from the URL and convert to buffer
    console.log('Fetching PDF from URL:', pdfUrl);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error('PDF fetch failed:', pdfResponse.status, pdfResponse.statusText);
      throw new Error(`Failed to fetch PDF from URL: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF fetched successfully, size:', pdfBuffer.byteLength);
    
    // Use a verified domain or the default Resend domain
    const fromEmail = process.env.FROM_EMAIL || '2610dylan@gmail.com';
    
    const invoiceLabel = invoiceNumber || invoiceId;

    const emailData = {
      from: fromEmail,
      to: [toEmail],
      cc: ccEmail ? [ccEmail] : undefined,
      subject: subject,
      html: message.replace(/\n/g, '<br>'),
      text: message, // Plain text fallback
      attachments: [
        {
          filename: `${clientName}-invoice-${invoiceLabel}.pdf`,
          content: Buffer.from(pdfBuffer)
        }
      ]
    };
    
    console.log('Sending email via Resend:', {
      from: fromEmail,
      to: toEmail,
      cc: ccEmail,
      subject: subject,
      invoiceId: invoiceId,
      invoiceNumber: invoiceLabel,
      pdfSize: pdfBuffer.byteLength
    });
    
    try {
      const { data, error } = await resend.emails.send(emailData);
      
      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Email sending failed: ${error.message}`);
      }
      
      console.log('Email sent successfully via Resend:', data);
    } catch (resendError) {
      console.error('Resend API error:', resendError);
      throw new Error(`Resend API error: ${resendError instanceof Error ? resendError.message : 'Unknown error'}`);
    }
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Email sent successfully',
        data: {
          to: toEmail,
          cc: ccEmail,
          subject: subject,
          invoiceId: invoiceId,
          invoiceNumber: invoiceLabel,
          clientName: clientName,
          timestamp: new Date().toISOString()
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 
