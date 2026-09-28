# AgentOS API Integration

This document describes the read-only API surface exposed to AgentOS for accessing CRM data without connecting AgentOS directly to the production database.

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

### Read-Only Access

All endpoints are strictly read-only. Write operations (creating leads, updating follow-ups, marking invoices as paid, etc.) are **not implemented** in this API surface.

Future write endpoints will require:
- Additional authentication/authorization mechanisms
- Audit logging
- Rate limiting
- Request validation

## Phase 2 Roadmap (Not Implemented)

Potential future write endpoints:

- `POST /api/agentos/leads` - Create new leads
- `PATCH /api/agentos/leads/:id` - Update lead status/notes
- `POST /api/agentos/follow-ups/:id/send` - Send a follow-up email
- `PATCH /api/agentos/follow-ups/:id` - Update follow-up status
- `POST /api/agentos/projects/:id/notes` - Add project notes

These are **stub comments only** and should not be implemented without:
1. Proper authorization design
2. Validation and business logic review
3. Audit trail implementation
4. Rate limiting strategy

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
