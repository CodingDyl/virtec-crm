# Ticket 002: Business Owner Command Centre

## Priority

P2 - Build after the automated follow-up queue, then reuse follow-up data as a key input.

## Business Goal

The business owner needs one screen that answers: what needs my attention today, where is money stuck, what work is at risk, and where can the business grow?

The existing overview shows useful high-level metrics, but it does not yet behave like a daily operating cockpit. Build a command centre that turns CRM data into decisions and next actions.

## Current App Context

Relevant existing areas:

- `components/custom-ui/overview-section.tsx` is the current overview UI.
- `contexts/DashboardContext.tsx` already computes total revenue, active projects, total customers, conversion rate, monthly revenue data, and recent customers.
- `contexts/DataContexts.tsx` already subscribes to customers, projects, quotes, expenses, maintenance invoices, and products.
- `components/custom-ui/workspace/HealthBadges.tsx` already calculates project health signals.
- `components/custom-ui/workspace/ProjectMargin.tsx` already handles project margin display.
- Ticket 001 will introduce `follow_ups`, which should feed into this command centre.

## User Stories

1. As the business owner, I want to open the CRM and immediately see what needs attention today.
2. As the business owner, I want to know who owes me money and how much is outstanding.
3. As the business owner, I want to see which quotes are likely to convert or go cold.
4. As the business owner, I want to see which projects are blocked, stale, or low-margin.
5. As the business owner, I want to see recurring maintenance revenue and upcoming renewals.
6. As the business owner, I want to see monthly profit pressure by comparing income and expenses.
7. As the business owner, I want growth prompts that help me sell more to existing clients in South Africa.

## Scope

### In Scope

Replace or substantially upgrade the current `Overview` tab with a command centre composed of:

- Today action queue
- Cash collection panel
- Pipeline panel
- Project risk panel
- Maintenance revenue panel
- Expense pressure panel
- Growth opportunities panel

### Out of Scope For V1

- Accounting platform sync.
- Payment gateway integration.
- Machine learning predictions.
- Multi-user dashboards.
- Custom report builder.
- Export to PDF.

## Recommended Layout

Use an operational dashboard layout, not a landing page.

Top row:

- `Cash to collect`
- `Open follow-ups`
- `Active project value`
- `Monthly recurring maintenance`

Main sections:

- `Today`
- `Money owed`
- `Pipeline`
- `Project risks`
- `Maintenance`
- `Growth opportunities`

The first viewport should immediately show business-critical numbers and actions.

## Command Centre Metrics

### Cash To Collect

Purpose: show outstanding money.

Inputs:

- `maintenance_invoices`
- Quote/project amounts where accepted but not yet paid, if payment status exists later

V1 calculation:

- Sum maintenance invoices where `status !== 'paid'`.
- Group by customer.
- Sort by oldest invoice date, then largest amount.

Display:

- Total outstanding
- Oldest overdue invoice
- Top 5 customers owing money
- Quick action link to related follow-up

### Open Follow-Ups

Purpose: make follow-ups visible on the home screen.

Inputs:

- `follow_ups` from Ticket 001

Display:

- Due today count
- Overdue count
- Highest-value follow-up
- Button/link to the `Follow-ups` tab

### Active Project Value

Purpose: estimate current workload value.

Inputs:

- `projects`
- `quotes`

V1 calculation:

- Sum `project.amount` for active projects.
- If no project amount exists, use accepted quote total for the project.

Display:

- Total active value
- Number of active projects
- Largest active project
- Stale active projects count

### Monthly Recurring Maintenance

Purpose: highlight recurring revenue.

Inputs:

- Maintenance projects
- `maintenanceAmount`
- `maintenanceFrequency`
- Maintenance invoices

V1 calculation:

- Monthly equivalent:
  - monthly = amount
  - quarterly = amount / 3
  - annual = amount / 12

Display:

- Estimated monthly recurring revenue
- Active maintenance customers
- Upcoming renewals/invoices
- Overdue maintenance invoices

### Pipeline

Purpose: show future work and quote performance.

Inputs:

- `quotes`
- `projects`
- `customers`

Display:

- Pending quote value
- Accepted quote value this month
- Quote conversion rate
- Pending quotes older than 3 days
- Top pending quotes by value

### Project Risks

Purpose: surface work that may damage margin, delivery, or client trust.

Inputs:

- `projects`
- `project_tasks`
- `activity`
- `expenses`

Risk rules:

- Stale: no activity/task movement in 7 days.
- Blocked: project status indicates hold/blocked, if available.
- Low progress: completion under 40% and project older than 14 days.
- Margin warning: expenses exceed 70% of project amount.
- Missing agreement: agreement not signed/approved.

Display:

- Risk count
- Top 5 risky projects
- Risk badges
- Suggested next action

### Expense Pressure

Purpose: reflect the owner's debit orders and operating costs.

Inputs:

- `expenses`
- Existing expense categories

V1 calculation:

- This month total expenses.
- Recurring technology/tool expenses if category or description indicates hosting, software, Firebase, Vercel, domains, email, subscriptions, or tools.
- Revenue minus expenses for current month.

Display:

- This month expenses
- Technology debit orders estimate
- Net month position
- Largest recurring cost

### Growth Opportunities

Purpose: show practical growth actions for a South African services business.

Inputs:

- `customers`
- `projects`
- `quotes`
- `maintenance`
- `products`

Rules:

- Customer has completed project but no maintenance: suggest maintenance upsell.
- Customer has maintenance but no recent project: suggest quarterly review.
- Quote rejected: suggest revised smaller package.
- High-value customer inactive for 60+ days: suggest check-in.
- Customer has design/project assets: suggest case study/testimonial request.

Display:

- Opportunity title
- Customer/project
- Estimated value, if possible
- Suggested action

## Data Model

Prefer deriving most command centre data client-side from existing contexts in V1.

Only add a collection if a metric needs persistent state.

Optional future collection:

```ts
export interface BusinessInsight {
  id: string;
  type:
    | 'cash_collection'
    | 'growth_opportunity'
    | 'project_risk'
    | 'expense_warning';
  status: 'open' | 'dismissed' | 'actioned';
  customerId?: string;
  projectId?: string;
  amount?: number;
  title: string;
  description: string;
  suggestedAction: string;
  createdAt: any;
  updatedAt: any;
}
```

For V1, avoid this collection unless needed. Calculated insights reduce data duplication and avoid stale records.

## Implementation Plan

### Step 1: Create Domain Helpers

Add:

- `lib/business-command-centre.ts`

Implement pure functions:

- `calculateCashToCollect`
- `calculateActiveProjectValue`
- `calculateMonthlyRecurringMaintenance`
- `calculatePipelineSummary`
- `calculateProjectRisks`
- `calculateExpensePressure`
- `calculateGrowthOpportunities`
- `buildCommandCentreSummary`

Each function should accept plain arrays and return plain objects. Keep Firestore subscriptions out of this file.

### Step 2: Extend Dashboard Data

Option A: Extend `contexts/DashboardContext.tsx`.

Pros:

- Reuses current dashboard provider.
- Less wiring.

Cons:

- Context may become too broad.

Option B: Create `contexts/CommandCentreContext.tsx`.

Pros:

- Clear ownership.
- Easier to test and grow.

Cons:

- More provider wiring.

Option C: Compute directly in `OverviewSection`.

Pros:

- Fastest first implementation.

Cons:

- UI becomes mixed with business logic.

Recommended: Option B if Ticket 001 is done first, because command centre will also consume `follow_ups`.

### Step 3: Build UI Components

Create:

- `components/custom-ui/command-centre/CommandCentre.tsx`
- `components/custom-ui/command-centre/MetricStrip.tsx`
- `components/custom-ui/command-centre/TodayQueue.tsx`
- `components/custom-ui/command-centre/CashCollectionPanel.tsx`
- `components/custom-ui/command-centre/PipelinePanel.tsx`
- `components/custom-ui/command-centre/ProjectRiskPanel.tsx`
- `components/custom-ui/command-centre/MaintenanceRevenuePanel.tsx`
- `components/custom-ui/command-centre/ExpensePressurePanel.tsx`
- `components/custom-ui/command-centre/GrowthOpportunitiesPanel.tsx`

Then update:

- `components/custom-ui/overview-section.tsx`

Either replace the internals with `<CommandCentre />` or migrate the current content into the new component.

### Step 4: Navigation Hooks

Where possible, each row should let the operator jump to the relevant work area:

- Follow-up row -> `Follow-ups` tab or project workspace.
- Outstanding invoice -> Maintenance section/project workspace.
- Pending quote -> Quotes tab or project workspace quote tab.
- Risky project -> Workspace with selected project.

If the current tab shell does not support deep selection yet, add the links as disabled/planned labels or route state in a simple way. Do not overbuild routing in V1.

### Step 5: Empty And Error States

Examples:

- No outstanding invoices: `No outstanding maintenance invoices.`
- No project risks: `No active project risks detected.`
- No growth opportunities: `No growth prompts right now.`

Avoid vague “everything looks good” copy unless the data has loaded successfully.

## Security Requirements

- Do not expose this screen outside authenticated CRM routes.
- Do not fetch command centre data from public portal routes.
- Do not add sensitive customer data to browser console logs.
- Keep calculations client-side only for authenticated operators, or server-side only behind `getOperator()`.
- Do not introduce `NEXT_PUBLIC_` variables for secrets.

## Acceptance Criteria

- The `Overview` tab shows the new command centre.
- The command centre shows top-level metrics for:
  - Cash to collect
  - Open follow-ups
  - Active project value
  - Monthly recurring maintenance
- The command centre shows a `Today` action list using open follow-ups from Ticket 001.
- The command centre shows top customers owing money.
- The command centre shows pending quote value and stale pending quotes.
- The command centre shows risky projects with at least one reason per project.
- The command centre shows this month expense pressure and technology debit order estimate.
- The command centre shows growth opportunities based on existing customers/projects.
- All panels have loading and empty states.
- The UI works on desktop and mobile without text overlap.
- No public portal page subscribes to command centre data.

## Testing Plan

Run:

```bash
npm run build
```

Manual test cases:

1. Add or identify unpaid maintenance invoices; confirm `Cash to collect` updates.
2. Add open follow-ups from Ticket 001; confirm `Today` and follow-up metrics update.
3. Add a pending quote older than 3 days; confirm pipeline warning appears.
4. Add an active project with no recent activity; confirm project risk appears.
5. Add expenses in current month; confirm expense pressure updates.
6. Add a completed customer project with no maintenance; confirm growth opportunity appears.
7. Check mobile viewport; confirm metric cards and tables do not overlap.

## Future Enhancements

- Weekly owner email digest.
- Profit and cashflow forecast.
- Accounting export.
- Payment gateway status once Pay-Now is prioritised.
- AI-generated business recommendations.
- Client segmentation by industry, value, and repeat work.
- South Africa-specific VAT/e-invoicing readiness panel.
