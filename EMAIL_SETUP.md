# Email Setup Guide

This guide explains how to set up email functionality for sending maintenance invoices with PDF attachments.

## Current Implementation

The email functionality is currently set up with a simulated email service. To enable real email sending, you need to choose and configure one of the following email services.

## Email Service Options

### Option 1: SendGrid (Recommended)

SendGrid is a popular email service with a generous free tier.

1. **Sign up**: Go to [SendGrid](https://sendgrid.com/) and create an account
2. **Get API Key**: Navigate to Settings > API Keys and create a new API key
3. **Install package**:
   ```bash
   npm install @sendgrid/mail
   ```
4. **Set environment variables**:
   ```env
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   FROM_EMAIL=noreply@yourdomain.com
   ```
5. **Update the API route**: Uncomment the SendGrid code in `app/api/send-email/route.ts`

### Option 2: Resend

Resend is a modern email API with excellent developer experience.

1. **Sign up**: Go to [Resend](https://resend.com/) and create an account
2. **Get API Key**: Copy your API key from the dashboard
3. **Install package**:
   ```bash
   npm install resend
   ```
4. **Set environment variables**:
   ```env
   RESEND_API_KEY=your_resend_api_key_here
   ```
5. **Update the API route**: Uncomment the Resend code in `app/api/send-email/route.ts`

### Option 3: Nodemailer with SMTP

Use your own SMTP server or email provider.

1. **Install package**:
   ```bash
   npm install nodemailer
   ```
2. **Set environment variables**:
   ```env
   SMTP_HOST=your_smtp_host
   SMTP_PORT=587
   SMTP_USER=your_smtp_username
   SMTP_PASS=your_smtp_password
   FROM_EMAIL=noreply@yourdomain.com
   ```
3. **Update the API route**: Uncomment the Nodemailer code in `app/api/send-email/route.ts`

## Environment Variables

Create a `.env.local` file in your project root and add the necessary environment variables:

```env
# Choose one of the following based on your email service:

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# OR Resend
RESEND_API_KEY=your_resend_api_key_here

# OR SMTP
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=noreply@yourdomain.com
```

## Features

The email functionality includes:

- **Email validation**: Validates email format before sending
- **PDF attachments**: Automatically attaches the maintenance invoice PDF
- **CC support**: Optional CC email addresses
- **Customizable messages**: Pre-filled with professional template
- **Status tracking**: Updates invoice status to 'emailed' after successful send
- **Error handling**: Comprehensive error handling and user feedback

## Usage

1. Navigate to the Maintenance Invoices table
2. Click the "Email Invoice" button for any pending invoice
3. Fill in the email form (pre-filled with client information)
4. Click "Send Email" to send the invoice with PDF attachment

## Testing

The current implementation simulates email sending for testing purposes. Check the browser console and server logs to see the email data that would be sent.

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive configuration
- Consider implementing rate limiting for the email API
- Validate all user inputs before processing

## Troubleshooting

### Common Issues

1. **Email not sending**: Check your API key and environment variables
2. **PDF attachment issues**: Ensure the PDF URL is accessible
3. **Rate limiting**: Most email services have sending limits
4. **Domain verification**: Some services require domain verification

### Debug Mode

To enable debug logging, add this to your environment variables:
```env
DEBUG_EMAIL=true
```

This will log detailed information about email sending attempts. 