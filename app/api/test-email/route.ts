import { NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Sends mail from the business's Resend account; operators only.
    const operator = await getOperator();
    if (!operator) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
    }

    const body = await request.json();
    const { toEmail } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Use Resend for email sending
    const { Resend } = require('resend');
    
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Use a verified domain or the default Resend domain
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    
    const emailData = {
      from: fromEmail,
      to: [toEmail],
      subject: 'Test Email from Virtara CRM',
      html: '<h1>Test Email</h1><p>This is a test email to verify Resend configuration.</p>',
      text: 'Test Email\n\nThis is a test email to verify Resend configuration.'
    };
    
    console.log('Sending test email via Resend:', {
      from: fromEmail,
      to: toEmail
    });
    
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: `Email sending failed: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log('Test email sent successfully via Resend:', data);
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Test email sent successfully',
        data: {
          to: toEmail,
          from: fromEmail,
          timestamp: new Date().toISOString()
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 