# Ticket 001: Automated Follow-Ups

## Priority

P1 - Start here before the command centre.

## Business Goal

Business owners lose money when accepted work, pending quotes, unsigned agreements, unpaid invoices, and maintenance renewals are not followed up at the right time. Build a follow-up system that tells the operator exactly who needs to be contacted, why, and what message should be sent.

This first version should focus on controlled operator-assisted follow-ups, not fully automatic outbound messaging. The system should generate due follow-up items, show them inside the CRM, and allow the operator to send or mark them done.

## Current App Context

Relevant existing areas:

- `components/dashboard.tsx` controls the main CRM tab shell.
- `components/custom-ui/workspace/ProjectWorkspace.tsx` already has project tabs for overview, quotes, documents, design, tasks, maintenance, and sharing.
- `components/custom-ui/workspace/ActivityTimeline.tsx` and `lib/activity.ts` already support activity logging.
- `components/custom-ui/workspace/QuotesTab.tsx` handles project quotes.
- `components/custom-ui/workspace/MaintenanceTab.tsx` handles maintenance billing.
- `app/api/send-email/route.ts` already sends invoice emails through Resend and requires an operator session.
- Existing Firestore collections include `customers`, `projects`, `quotes`, `maintenance_invoices`, `project_tasks`, `activity`, and storage-backed documents.

## User Stories

1. As the business owner, I want to see a list of follow-ups due today so I do not forget to chase money or decisions.
2. As the business owner, I want the CRM to identify overdue invoices so I can prioritise cash collection.
3. As the business owner, I want the CRM to identify pending quotes that have not been answered so I can close more deals.
4. As the business owner, I want the CRM to identify unsigned agreements so projects do not start without paperwork.
5. As the business owner, I want the CRM to identify upcoming maintenance renewals so recurring revenue does not go quiet.
6. As the business owner, I want suggested email/WhatsApp copy so follow-up takes seconds, not minutes.
7. As the business owner, I want every sent or dismissed follow-up logged against the customer/project.

## Scope

### In Scope

- New Firestore collection: `follow_ups`.
- New CRM tab: `Follow-ups`.
- A scheduled or manual generation function that creates follow-up records from existing data.
- Follow-up types:
  - `quote_pending`
  - `agreement_pending`
  - `invoice_overdue`
  - `maintenance_renewal`
  - `project_stale`
- Follow-up statuses:
  - `open`
  - `sent`
  - `dismissed`
  - `snoozed`
- Suggested message templates for email and WhatsApp/manual copy.
- Actions:
  - Send email where an email address exists.
  - Copy WhatsApp/manual message to clipboard.
  - Mark as done.
  - Snooze for 1, 3, or 7 days.
- Activity logging after send, dismiss, or snooze.

### Out of Scope For V1

- Fully automatic WhatsApp sending.
- Payment gateway integration.
- AI-generated custom messages.
- Multi-operator assignment.
- Complex marketing campaigns.
- SMS integration.

## Proposed Information Architecture

Add a main dashboard tab:

- `Overview`
- `Workspace`
- `Follow-ups`
- `Quotes`
- `Expenses`
- `Products`
- `Maintenance Table`
- `Subscriptions`
- `Passwords`

The `Follow-ups` screen should be an operational queue, not a marketing page.

Recommended sections:

- `Due Today`
- `Overdue`
- `Upcoming`
- `Done`

Each row/card should show:

- Customer name
- Company name, if available
- Project name/type, if linked
- Follow-up reason
- Due date
- Amount at risk, if applicable
- Suggested channel
- Message preview
- Actions

## Firestore Data Model

Create `types/follow-up.ts`.

```ts
export type FollowUpType =
  | 'quote_pending'
  | 'agreement_pending'
  | 'invoice_overdue'
  | 'maintenance_renewal'
  | 'project_stale';

export type FollowUpStatus = 'open' | 'sent' | 'dismissed' | 'snoozed';

export interface FollowUp {
  id: string;
  type: FollowUpType;
  status: FollowUpStatus;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  projectId?: string;
  projectName?: string;
  quoteId?: string;
  invoiceId?: string;
  amount?: number;
  dueAt: any;
  snoozedUntil?: any;
  reason: string;
  suggestedSubject?: string;
  suggestedMessage: string;
  lastSentAt?: any;
  createdAt: any;
  updatedAt: any;
  sourceKey: string;
}
```

`sourceKey` prevents duplicates. Examples:

- `quote_pending:{quoteId}:3d`
- `invoice_overdue:{invoiceId}:7d`
- `agreement_pending:{projectId}:5d`
- `maintenance_renewal:{projectId}:{yyyy-mm}`
- `project_stale:{projectId}:7d`

## Follow-Up Rules

Use conservative defaults in V1.

### Pending Quote

Create a follow-up when:

- Quote status is `pending`.
- Quote was created at least 3 days ago.
- No open follow-up with the same `sourceKey` exists.

Suggested message:

> Hi {firstName}, just checking whether you had a chance to review the quote for {projectName}. I can help with any questions or adjustments.

### Pending Agreement

Create a follow-up when:

- Project has `agreementStatus` equal to `pending`.
- Agreement has been pending at least 5 days.
- Project status is not completed/cancelled.

Suggested message:

> Hi {firstName}, just following up on the agreement for {projectName}. Once it is approved/signed, we can keep things moving.

### Overdue Invoice

Create a follow-up when:

- Maintenance invoice status is not `paid`.
- Invoice date or due date is older than the configured threshold.
- Start with 7 days after invoice date if no due date field exists.

Suggested message:

> Hi {firstName}, just a reminder that invoice {invoiceNumber} for R{amount} is still outstanding. Please let me know if you need anything from my side.

### Maintenance Renewal

Create a follow-up when:

- Project is a maintenance project.
- Next billing/renewal date is within 7 days.
- No invoice/follow-up exists for that billing period.

Suggested message:

> Hi {firstName}, your monthly maintenance period for {projectName} is coming up. I will prepare the next invoice unless anything needs to change.

### Stale Project

Create a follow-up when:

- Project status is active/in progress.
- No activity or task update has happened in 7 days.
- Project completion is below 100.

Suggested internal message:

> Project has had no recorded movement for 7 days. Check whether the client, design, development, or billing side is blocking progress.

## Implementation Plan

### Step 1: Types And Helpers

- Add `types/follow-up.ts`.
- Add `lib/follow-ups.ts`.
- Implement:
  - `normalizeFollowUp`
  - `createFollowUpSourceKey`
  - `buildSuggestedFollowUpMessage`
  - `getFollowUpDisplayMeta`

Keep helper functions pure and unit-testable where possible.

### Step 2: Context Provider

- Add a `FollowUpsProvider` in `contexts/DataContexts.tsx` or a separate `contexts/FollowUpsContext.tsx`.
- Subscribe to `follow_ups`.
- Expose:
  - `followUps`
  - `openFollowUps`
  - `dueTodayFollowUps`
  - `overdueFollowUps`
  - `isLoading`
  - `markFollowUpSent`
  - `dismissFollowUp`
  - `snoozeFollowUp`

Register the provider inside `components/crm-providers.tsx`.

### Step 3: Generation API

Add API route:

- `app/api/follow-ups/generate/route.ts`

Requirements:

- Must call `getOperator()` and reject unauthorised requests.
- Read required collections server-side through Firebase Admin.
- Create only missing follow-ups by checking `sourceKey`.
- Return a summary:

```json
{
  "created": 4,
  "skipped": 12,
  "createdByType": {
    "invoice_overdue": 2,
    "quote_pending": 1,
    "project_stale": 1
  }
}
```

V1 can run manually from a button in the UI. Later this can be called by Vercel Cron.

### Step 4: Follow-Ups UI

Create:

- `components/custom-ui/follow-ups/FollowUpsSection.tsx`
- `components/custom-ui/follow-ups/FollowUpItem.tsx`
- `components/custom-ui/follow-ups/FollowUpFilters.tsx`

Add a `Follow-ups` tab in `components/dashboard.tsx`.

UI requirements:

- Dense, operational layout.
- No marketing hero.
- Show clear empty states.
- Include loading and error states.
- Use existing `Button`, `Badge`, `Card`, `Tabs`, `Input` components.
- Use lucide icons for actions where useful.

### Step 5: Email Send Support

Do not modify the existing invoice email route into a generic proxy.

Add a dedicated route:

- `app/api/follow-ups/send-email/route.ts`

Requirements:

- Must require an operator session.
- Must validate recipient email.
- Must only accept a `followUpId` and optional edited message, not arbitrary attachment URLs.
- Load the follow-up from Firestore.
- Send through Resend.
- Update follow-up status to `sent`.
- Write activity log entry.

### Step 6: Manual/WhatsApp Copy

For V1, add a `Copy message` button that copies the suggested message to clipboard.

After copy:

- Do not mark as sent automatically.
- Show a `Mark done` action.
- When marked done, set status to `sent` or `dismissed` depending on chosen action.

## Security Requirements

- Every API route must call `getOperator()` before reading or writing CRM data.
- Do not expose full customer datasets through public portal routes.
- Do not accept arbitrary email sender/from values from the client.
- Do not allow the client to forge `customerId`, `amount`, or `sourceKey` during send actions. Load the follow-up server-side.
- Avoid logging full message bodies with personal information.

## Acceptance Criteria

- A new `Follow-ups` tab appears in the CRM.
- Operator can click `Generate follow-ups`.
- The system creates follow-ups for pending quotes older than 3 days.
- The system creates follow-ups for pending agreements older than 5 days.
- The system creates follow-ups for unpaid maintenance invoices older than 7 days.
- The system creates follow-ups for maintenance renewals due within 7 days.
- The system creates follow-ups for stale active projects with no recent activity.
- Running generation twice does not create duplicates.
- Operator can send an email follow-up where the customer has an email address.
- Operator can copy a manual/WhatsApp message.
- Operator can snooze a follow-up.
- Operator can dismiss a follow-up.
- Sent, dismissed, and snoozed actions are logged to activity.
- Unauthorised requests to follow-up API routes return 401.

## Testing Plan

Run:

```bash
npm run build
```

Manual test cases:

1. Create a pending quote with an old `createdAt`; generate follow-ups; confirm one quote follow-up appears.
2. Generate again; confirm no duplicate appears.
3. Mark the quote follow-up as dismissed; confirm it moves out of open list.
4. Create an unpaid maintenance invoice older than 7 days; confirm overdue invoice follow-up appears.
5. Send email follow-up to a test customer; confirm Resend succeeds and activity entry is written.
6. Attempt follow-up generation while signed out; confirm 401.
7. Confirm portal routes do not mount follow-up subscriptions.

## Future Enhancements

- Vercel Cron daily generation.
- WhatsApp Business API integration.
- AI-personalised message suggestions.
- Escalation levels: first reminder, second reminder, final notice.
- Payment links once the Pay-Now feature is prioritised.
- Follow-up analytics: average days to payment, conversion by follow-up type.
