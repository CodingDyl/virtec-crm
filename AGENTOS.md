# AgentOS API Integration

This document describes the API surface exposed to AgentOS — read-only, plus two narrow write routes — for accessing CRM data without connecting AgentOS directly to the production database.

## Authentication

All AgentOS endpoints require Bearer token authentication using an API key stored in the `AGENTOS_API_KEY` environment variable.

**Header format:**
```
Authorization: Bearer <AGENTOS_API_KEY>
```

### Setup

1. Generate a secure API key (minimum 32 characters recommended)
2. Set the `AGENTOS_API_KEY` environment variable in your deployment environment
3. Configure AgentOS to use this API key for all CRM API requests

**Security notes:**
- Never commit the API key to version control
- Rotate the key periodically
- Use a different key for each environment (dev, staging, production)
- Consider using a secrets manager for production deployments

## Endpoints

All endpoints are read-only and return JSON responses. The base path for all AgentOS endpoints is `/api/agentos/`.

### GET /api/agentos/leads

Returns local leads data from the CRM.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `status` (optional): Filter by lead status (`new`, `reviewing`, `qualified`, `disqualified`, `converted`)
- `track` (optional): Filter by track (`virtara`, `jurivo`)

**Example Response:**
```json
{
  "leads": [
    {
      "id": "abc123",
      "name": "Example Law Firm",
      "phone": "+27123456789",
      "websiteUrl": "https://example.com",
      "address": "123 Main St, Cape Town",
      "category": "lawyer",
      "track": "jurivo",
      "area": "Cape Town",
      "websiteSignal": "weak",
      "score": 75,
      "scoreReasons": ["No website detected", "High rating"],
      "status": "new",
      "ownerEmail": "info@example.com",
      "emailConfidence": "medium",
      "outreachStage": "o1",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "limit": 100
}
```

**Field Notes:**
- `websiteSignal`: Indicates website quality (`none`, `facebook_only`, `weak`, `ok`, `unknown`)
- `score`: Lead quality score (0-100)
- `status`: Current lead status
- `outreachStage`: Current outreach stage (`none`, `o1`, `o2`, `o3`, `replied`, `stopped`)

---

### GET /api/agentos/clients

Returns customer/client data from the CRM.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `status` (optional): Filter by active status (`true` for active, `false` for inactive)
- `maintenance` (optional): Filter by maintenance status (`true` or `false`)

**Example Response:**
```json
{
  "clients": [
    {
      "id": "client123",
      "name": "John Smith",
      "email": "john@example.com",
      "companyName": "Example Corp",
      "contactNumber": "+27123456789",
      "totalSpent": 45000,
      "maintenance": true,
      "status": true,
      "createdAt": "2023-06-01T10:00:00Z"
    }
  ],
  "count": 1,
  "limit": 100
}
```

**Field Notes:**
- `totalSpent`: Total amount spent by the client (in Rand)
- `maintenance`: Whether the client has an active maintenance contract
- `status`: `true` for active clients, `false` for inactive

---

### GET /api/agentos/quotes

Returns quote data from the CRM.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `status` (optional): Filter by quote status (`pending`, `accepted`, `rejected`)

**Example Response:**
```json
{
  "quotes": [
    {
      "id": "quote123",
      "projectId": "proj456",
      "projectType": "Website Development",
      "clientId": "client123",
      "totalAmount": 25000,
      "status": "pending",
      "features": ["Responsive design", "CMS integration", "SEO optimization"],
      "createdAt": "2024-01-10T14:30:00Z",
      "pdfUrl": "https://storage.googleapis.com/...",
      "pdfPath": "quotes/quote123.pdf"
    }
  ],
  "count": 1,
  "limit": 100
}
```

**Field Notes:**
- `totalAmount`: Quote value in Rand
- `status`: Current quote status
- `features`: Array of project features/requirements included in the quote
- `pdfUrl`/`pdfPath`: References to the quote PDF document

---

### GET /api/agentos/projects

Returns project data from the CRM.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `status` (optional): Filter by project status (e.g., `active`, `completed`, `on-hold`)

**Example Response:**
```json
{
  "projects": [
    {
      "id": "proj456",
      "projectType": "Website Development",
      "clientName": "Example Corp",
      "clientId": "client123",
      "amount": 25000,
      "status": "active",
      "completion": 65,
      "quoteId": "quote123",
      "agreementStatus": "signed",
      "createdAt": "2024-01-15T09:00:00Z",
      "portalEnabled": true,
      "maintenanceFrequency": "monthly",
      "maintenanceAmount": 2500,
      "serviceSku": "care"
    }
  ],
  "count": 1,
  "limit": 100
}
```

**Field Notes:**
- `amount`: Project value in Rand
- `completion`: Project completion percentage (0-100)
- `agreementStatus`: Status of client agreement (`pending`, `approved`, `declined`, `signed`)
- `portalEnabled`: Whether the client portal is enabled for this project
- `maintenanceFrequency`: Billing frequency for maintenance projects (`monthly`, `quarterly`, `biannual`, `annual`)
- `maintenanceAmount`: Expected charge per billing cycle in Rand
- `serviceSku`: Virtara recurring SKU (`care`, `seo`, `bundle`)

**Security Note:**
- `portalToken` (secret share link) is intentionally excluded from the response

---

### GET /api/agentos/follow-ups

Returns follow-up/reminder data from the CRM.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `status` (optional): Filter by status (`open`, `sent`, `dismissed`, `snoozed`)
- `type` (optional): Filter by type (`quote_pending`, `agreement_pending`, `invoice_overdue`, `maintenance_renewal`, `project_stale`)

**Example Response:**
```json
{
  "followUps": [
    {
      "id": "followup123",
      "type": "quote_pending",
      "status": "open",
      "customerId": "client123",
      "customerName": "John Smith",
      "companyName": "Example Corp",
      "customerEmail": "john@example.com",
      "customerPhone": "+27123456789",
      "projectId": "proj456",
      "projectName": "Website Development",
      "quoteId": "quote123",
      "amount": 25000,
      "dueAt": "2024-01-20T10:00:00Z",
      "reason": "Pending quote has had no answer for 5 days.",
      "suggestedSubject": "Following up on your quote",
      "suggestedMessage": "Hi John...",
      "createdAt": "2024-01-18T10:00:00Z"
    }
  ],
  "count": 1,
  "limit": 100
}
```

**Field Notes:**
- `type`: Type of follow-up action needed
- `status`: Current follow-up status
- `amount`: Associated amount in Rand (if applicable)
- `dueAt`: When the follow-up is due
- `suggestedSubject`/`suggestedMessage`: AI-generated follow-up communication templates

---

### GET /api/agentos/revenue-summary

Returns aggregated revenue metrics from the CRM.

**Query Parameters:** None

**Example Response:**
```json
{
  "monthlyRecurringRevenue": 125000,
  "activeMaintenanceCustomers": 42,
  "upcomingInvoicesCount": 8,
  "overdueInvoiceCount": 3,
  "pendingQuoteValue": 385000,
  "acceptedQuoteValueThisMonth": 95000,
  "totalAcceptedRevenue": 2450000,
  "totalMaintenanceRevenue": 875000,
  "totalRevenue": 3325000,
  "quoteConversionRate": 68.5,
  "stalePendingQuoteCount": 5
}
```

**Field Notes:**
- `monthlyRecurringRevenue`: Total MRR from active maintenance contracts (in Rand)
- `activeMaintenanceCustomers`: Number of clients with active maintenance
- `upcomingInvoicesCount`: Number of maintenance invoices due in the next 14 days
- `overdueInvoiceCount`: Number of unpaid invoices overdue by 7+ days
- `pendingQuoteValue`: Total value of pending quotes (in Rand)
- `acceptedQuoteValueThisMonth`: Value of quotes accepted this month (in Rand)
- `totalAcceptedRevenue`: Lifetime total from accepted quotes (in Rand)
- `totalMaintenanceRevenue`: Lifetime total from paid maintenance invoices (in Rand)
- `totalRevenue`: Combined lifetime revenue (in Rand)
- `quoteConversionRate`: Percentage of quotes that were accepted
- `stalePendingQuoteCount`: Pending quotes with no response for 3+ days

---

## Error Responses

All endpoints return standard HTTP status codes:

- **200 OK**: Request succeeded
- **401 Unauthorized**: Missing or invalid API key
- **500 Internal Server Error**: Server error processing the request
- **503 Service Unavailable**: API key not configured on the deployment

**Error Response Format:**
```json
{
  "error": "Error message describing what went wrong"
}
```

## Security & Compliance

### Data Exclusions

All endpoints explicitly exclude credential and password fields:

- **Projects**: `portalToken` (secret share link) is excluded
- **General**: No password or authentication token fields are exposed

### Write Access

Two routes can change data, and each can change only the fields listed:

| Route | Fields | Allowed values |
| --- | --- | --- |
| `PATCH /api/agentos/follow-ups/:id` | `status`, `snoozedUntil` | `sent`, `dismissed`, `snoozed` (with a future `snoozedUntil`, at most 90 days out) |
| `PATCH /api/agentos/leads/:id` | `status` | `new`, `reviewing`, `qualified`, `disqualified` |

Everything else — creating leads, sending email, marking invoices paid,
converting a lead to a customer, reopening a follow-up — stays in the CRM.

**Authentication.** Writes use a separate key:

```
Authorization: Bearer <AGENTOS_WRITE_API_KEY>
```

The read key cannot write and the write key cannot read. If
`AGENTOS_WRITE_API_KEY` is missing, or equal to `AGENTOS_API_KEY`, both write
routes answer 503 until it is fixed. Keys are compared in constant time.

**Validation.** A body is read field by field; any field not in the table is
a 400. Ids must look like Firestore document ids.

**Rules the routes enforce.**

- A follow-up already `sent` or `dismissed` is not changed (409).
- A `converted` lead is not changed (409) — conversion owns a customer record.
- Setting a lead to the status it already has is a no-op (`changed: false`).
- Places rescans preserve `reviewing`, `qualified` and `disqualified`, so a
  scan does not undo a status set from AgentOS.

**Audit.** Every write lands in one Firestore transaction with an
`agentos_audit` document: route, document id, and the touched fields before and
after. Follow-up writes also add an entry to the project's or customer's
activity log, the same way sending an email from the CRM does. `agentos_audit`
is written only by the Admin SDK; `firestore.rules` names no rule for it, so
the catch-all deny keeps it closed to browsers.

**Rate limit.** 30 writes per minute per server instance (429 beyond that).
Serverless instances do not share memory, so this bounds a runaway loop in
AgentOS rather than a distributed attack; the write key is the real control.

**Responses.**

```json
{ "followUp": { "id": "followup123", "status": "sent" } }
{ "lead": { "id": "abc123", "status": "reviewing", "changed": true } }
```

Errors: 400 invalid body or id · 401 wrong key · 404 no such document ·
409 not allowed from its current state · 429 rate limited · 503 write key not
configured.

## Not Implemented

Still stubs, and not to be added without their own authorization and
business-logic review:

- `POST /api/agentos/leads` - Create new leads
- `POST /api/agentos/follow-ups/:id/send` - Send a follow-up email
- `POST /api/agentos/projects/:id/notes` - Add project notes

## Website leads

Leads from the Virtara and Jurivo websites land in the `inbound_leads`
collection. They are separate from `localLeads` (Places scans): a person who
filled in a form, not a business we found.

### POST /api/inbound/leads (websites only)

Called server-to-server by each site's backend. Never from a browser: the key
must not ship to a client, and the route sends no CORS headers.

- Auth: `Authorization: Bearer <VIRTARA_SITE_LEADS_KEY | JURIVO_SITE_LEADS_KEY>`.
  The key decides the track. Keys must be 24+ characters and differ from each
  other and from both AgentOS keys, or the route answers 503.
- Body (JSON, 16 KB max, unknown fields rejected):
  `source` (required: start-a-project, contact, seo, starter, professional,
  enterprise, health-check, audit, demo-request, or `magnet-<slug>` for a
  lead magnet), `name` (required, 120),
  `email` (required), `phone` (40), `company` (160), `website` (http/https,
  300), `message` (4000), `details` (up to 12 short answers, 300 each),
  `consent` (boolean), `utm` ({source, medium, campaign}), `page` (200).
- 201 `{ id, duplicate: false }`; 200 `{ id, duplicate: true }` when the same
  email sent the same form on the same site in the last 10 minutes; 400 with
  `details` listing every problem; 429 over 20 leads a minute per site per
  instance.
- If `INBOUND_NOTIFY_EMAIL` and `RESEND_API_KEY` are set, the team gets an
  email (visitor values escaped, visitor address as reply-to).

Status starts at `new`. Firestore rules let operators read, update and delete
these leads in the dashboard (Local leads, Website) but never create them.

### GET /api/agentos/inbound-leads (read key)

Newest first. `limit` (default 100, max 500), `status` (new, reviewing,
replied, won, not_a_fit, spam). Timestamps are ISO strings.

### PATCH /api/agentos/inbound-leads/:id (write key)

Body `{ "status": "new" | "reviewing" | "replied" | "not_a_fit" | "spam" }`.
Written with an `agentos_audit` record in one transaction. `won` is set in
the CRM, not from AgentOS.

### Lead magnet emails

A signup whose source is `magnet-<slug>` is sent that magnet's email at once,
if one is published and switched on for the lead's site. The outcome is on
the lead as `nurtureSentAt` or `nurtureError` (both in the inbound-leads GET).
Sender: `VIRTARA_FROM_EMAIL` / `JURIVO_FROM_EMAIL` (else `FROM_EMAIL`), on a
domain verified in Resend; reply-to `VIRTARA_REPLY_TO` / `JURIVO_REPLY_TO`
(else the first `INBOUND_NOTIFY_EMAIL`).

#### PUT /api/agentos/lead-magnet-emails/:slug (write key)

Body `{ "track", "subject", "body", "readUrl", "enabled" }`. `body` is plain
text and must contain `{{link}}`; `{{firstName}}` is optional. `readUrl` must
be https; the email links to it with `?via=email`. Audited.

#### GET /api/agentos/lead-magnet-emails (read key)

Every published template.

## Usage Example

```bash
# Fetch all new leads from the Virtara track
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-domain.com/api/agentos/leads?status=new&track=virtara&limit=50"

# Get revenue summary
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-domain.com/api/agentos/revenue-summary"

# Fetch open follow-ups
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-domain.com/api/agentos/follow-ups?status=open"

# Mark a follow-up sent (write key)
curl -X PATCH -H "Authorization: Bearer your-write-key-here" -H "Content-Type: application/json" \
  -d '{"status":"sent"}' "https://your-domain.com/api/agentos/follow-ups/followup123"
```

## Monitoring & Maintenance

- Monitor API usage and error rates in your deployment logs
- Review and rotate the API key periodically
- Consider implementing rate limiting if AgentOS usage scales significantly
- Add request logging for audit purposes if handling sensitive data

## Support & Questions

For questions about this API integration, refer to:
- This documentation
- The implementation in `app/api/agentos/` and `lib/agentos-auth.ts`
- The existing CRM data model types in `types/`
