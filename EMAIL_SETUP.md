# Email Setup Guide

This guide explains how to set up email functionality for sending maintenance invoices with PDF attachments.

## Current Implementation

The email functionality is now configured to use **Resend** as the email service provider. Resend is a modern email API with excellent developer experience and reliable delivery.

## Email Service Configuration

### Resend Setup (Currently Active)

Resend is a modern email API with excellent developer experience.

1. **Sign up**: Go to [Resend](https://resend.com/) and create an account
2. **Get API Key**: Copy your API key from the dashboard
3. **Install package** (already installed):
   ```bash
   npm install resend
   ```
4. **Set environment variables**:
   ```env
   RESEND_API_KEY=your_resend_api_key_here
   ```
5. **Domain Verification**: Verify your domain in Resend dashboard for better deliverability

### Alternative Email Services

If you prefer to use a different email service, you can modify the API route in `app/api/send-email/route.ts`:

#### SendGrid
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
5. **Update the API route**: Replace the Resend code with SendGrid implementation

#### Nodemailer with SMTP
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
3. **Update the API route**: Replace the Resend code with Nodemailer implementation



## Environment Variables

Create a `.env.local` file in your project root and add the necessary environment variables:

```env
# Resend (Currently Active)
RESEND_API_KEY=your_resend_api_key_here

# Optional: Custom from email (must be verified in Resend)
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
3. **Rate limiting**: Resend has a limit of 100 emails/day on free tier
4. **Domain verification**: Verify your domain in Resend dashboard for better deliverability
5. **API key issues**: Ensure your RESEND_API_KEY is correctly set in `.env.local`

### Resend-Specific Issues

1. **Domain not verified**: 
   - By default, the system uses `onboarding@resend.dev` for testing
   - To use your own domain, verify it in Resend dashboard and set `FROM_EMAIL` in `.env.local`
   - Unverified domains will cause sending failures

2. **Attachment size**: Resend supports attachments up to 25MB
3. **Rate limits**: Resend has a limit of 100 emails/day on free tier
4. **Spam filters**: Ensure your content doesn't trigger spam filters
5. **API key issues**: Ensure your RESEND_API_KEY is correctly set and valid

### Debug Mode

To enable debug logging, add this to your environment variables:
```env
DEBUG_EMAIL=true
```

This will log detailed information about email sending attempts.

### Testing

You can test the email functionality by:
1. Creating a maintenance invoice
2. Clicking the "Email Invoice" button
3. Filling in the email form
4. Clicking "Send Email"

Check the browser console and server logs for detailed information about the email sending process. 