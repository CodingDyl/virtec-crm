import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toEmail, ccEmail, subject, message, invoiceId, pdfUrl, clientName } = body;

    // Validate required fields
    if (!toEmail || !subject || !message || !pdfUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    // For production, you would integrate with a real email service here
    // Here are some popular options:

    // Option 1: SendGrid
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: toEmail,
      cc: ccEmail,
      from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
      attachments: [
        {
          content: await fetch(pdfUrl).then(res => res.arrayBuffer()).then(buffer => Buffer.from(buffer).toString('base64')),
          filename: `maintenance-invoice-${invoiceId}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };
    
    await sgMail.send(msg);
    */

    // Option 2: Resend
    /*
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: 'Virtara <noreply@yourdomain.com>',
      to: [toEmail],
      cc: ccEmail ? [ccEmail] : undefined,
      subject: subject,
      html: message.replace(/\n/g, '<br>'),
      attachments: [
        {
          filename: `maintenance-invoice-${invoiceId}.pdf`,
          content: await fetch(pdfUrl).then(res => res.arrayBuffer())
        }
      ]
    });
    
    if (error) {
      throw new Error(error.message);
    }
    */

    // Option 3: Nodemailer with SMTP
    /*
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    const pdfBuffer = await fetch(pdfUrl).then(res => res.arrayBuffer());
    
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: toEmail,
      cc: ccEmail,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
      attachments: [
        {
          filename: `maintenance-invoice-${invoiceId}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    });
    */

    // For now, we'll simulate a successful email send
    // In production, uncomment one of the above email service implementations
    
    console.log('Email would be sent with data:', {
      to: toEmail,
      cc: ccEmail,
      subject: subject,
      message: message,
      invoiceId: invoiceId,
      pdfUrl: pdfUrl,
      clientName: clientName
    });

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Email sent successfully',
        data: {
          to: toEmail,
          cc: ccEmail,
          subject: subject,
          invoiceId: invoiceId,
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