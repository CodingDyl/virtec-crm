# Unified Customer + Project Workspace — Design Spec

**Date:** 2026-07-24
**Status:** Approved for planning (Phase 1 first)
**Author:** Dylan Petzer (with Claude)

## 1. Problem & Goal

Managing the business today means hopping between disconnected tabs (Customers, Projects, Quotes, Maintenance). Uploaded documents (letters/agreements/other) are only reachable inside a project edit dialog and effectively invisible. There is no place to capture design ideas or drive a project through delivery.

**Goal:** one customer- and project-centric **Workspace** where the user manages customers, projects, quotes, documents, design ideas, and delivery tasks together — and can customise/track each project end-to-end.

## 2. Approach

A new **Workspace** tab becomes the primary home, replacing the separate **Customers** and **Projects** tabs. It is a **three-pane drill-down**:

```
Customers  ▸  <Customer>'s Projects (+ 360° header)  ▸  Project Workspace (tabbed)
```

Overview, Quotes, Maintenance, Subscriptions, Passwords tabs remain (Quotes/Maintenance stay useful as global financial reports). The Workspace reuses the existing realtime contexts (`useCustomers`, `useProjects`, `useQuotes`) so all data stays live. Selection state is local React state: `selectedCustomerId` → `selectedProjectId` → `activeWorkspaceTab`.

### Rejected alternatives
- **Customer-centric single panel (A)** — simpler but hides the delivery/project dimension.
- **Project Kanban board (B)** — great for pipeline but de-emphasises the customer relationship the user thinks in.
- **Generic DataTable refactor** — out of scope; no sort/CSV requirement.

## 3. Data Model (Firestore)

All changes are **additive** — no destructive migration. New collections coexist with existing data.

### Existing (unchanged or extended)
- **`customers`** — unchanged.
- **`projects`** — unchanged shape: `clientId`, `clientName`, `amount`, `status` (`active|completed|on-hold`), `completion`, `quoteId`, `agreementUrl`, `agreementStatus`, `createdAt`.
- **`quotes`** — unchanged; uploaded quotes already carry `source: 'uploaded'`.
- **`documents`** — extend `linkedType` to allow `'customer'` in addition to `'project'`. Shape: `{ name, type: 'quote'|'letter'|'agreement'|'other', fileUrl, storagePath, linkedType, linkedId, uploadedAt }`.

### New collections
- **`design_items`** — `{ id, projectId, kind: 'image' | 'link', url, storagePath?, title, createdAt }`.
  - `kind: 'image'` → file in Storage at `design/projects/{projectId}/{ts}_{name}`, `url` = download URL, `storagePath` set.
  - `kind: 'link'` → `url` is the pasted URL (Figma/Canva/live site), no `storagePath`.
- **`project_tasks`** — `{ id, projectId, title, done: boolean, dueDate?: Timestamp, order: number, createdAt }`.
- **`activity`** — `{ id, refType: 'project' | 'customer', refId, type: string, message: string, createdAt }`. Written on key mutations.

### Derived data
- **Completion %:** when a project has ≥1 `project_tasks`, completion = `round(doneCount / totalCount * 100)` and the manual completion field is read-only/hidden. With zero tasks, the manual `completion` field is used (current behaviour).

## 4. Components

New directory: `components/custom-ui/workspace/`.

- **`Workspace.tsx`** — three-pane shell; owns selection state; renders the three panes.
- **`CustomerPane.tsx`** — searchable customer list (left); "Add customer" reuses `AddCustomerModal`.
- **`ProjectPane.tsx`** — selected customer's projects (middle) + **`CustomerHeader.tsx`** (360° summary: total value, active projects, outstanding quotes, contact); "Add project" reuses `AddProjectModal`.
- **`ProjectWorkspace.tsx`** — right pane; tab bar + tab panels:
  - **`OverviewTab.tsx`** — inline-editable project header (status/amount/client re-link/agreement) + `ActivityTimeline.tsx` + `HealthBadges.tsx`.
  - **`QuotesTab.tsx`** — project-linked quotes; accept→link/create; reuse `UploadDocumentModal`.
  - **`DocumentsTab.tsx`** — lists `documents` for the project (view/download/delete). Fixes upload visibility.
  - **`DesignTab.tsx`** — Ideas board: `design_items` grid; upload image or paste link; delete.
  - **`TasksTab.tsx`** — `project_tasks` checklist with due dates, reorder, add/delete; drives completion.
- **Cross-cutting:** `CommandSearch.tsx` (global ⌘K search over customers/projects/quotes), reuse existing `ConfirmDialog`, `TablePagination`, `usePagination`.

Existing `customers-table.tsx` and `projects-table.tsx` are retired from the dashboard tab list once Phase 1 is verified (files kept until then, then removed).

## 5. Data Flow & Error Handling

- Reads: realtime contexts for customers/projects/quotes; per-project `documents`/`design_items`/`project_tasks` fetched on project selection (getDocs) or via `onSnapshot` for live updates within the open workspace.
- Writes: direct Firestore mutations; every mutation that matters appends an `activity` entry.
- Errors: `try/catch` with `react-toastify` toasts (existing pattern). Uploads show progress/disabled state.
- Deletes: `ConfirmDialog` + Storage cleanup for any `storagePath` (documents, design images, agreements).

## 6. Phased Build Order

Each phase ends with `npm run build` (type-check) + browser smoke-test against live data.

- **Phase 1 — Foundation:** three-pane shell, `CustomerPane`, `ProjectPane` + `CustomerHeader`, `OverviewTab` (inline edit), `DocumentsTab`. Replace Customers/Projects tabs with Workspace. *Delivers: unified nav + document visibility.*
- **Phase 2 — Delivery:** `QuotesTab` in-workspace, Quote→Project→Invoice chain, `ActivityTimeline`, `HealthBadges`.
- **Phase 3 — Design & Tasks:** `DesignTab` (ideas board), `TasksTab` (auto-completion).
- **Phase 4 — Polish:** `CommandSearch`, safe-delete sweep across customers/projects/quotes/documents.

## 7. Testing & Safety

- Type safety via `npm run build`; manual browser smoke-tests per phase.
- Additive data model; old tabs remain reachable until Phase 1 verified, then removed.
- **Out of scope (user's responsibility):** Firebase Storage & Firestore **security rules** in the console. New Storage path prefixes to allow: `design/projects/**` (in addition to existing `documents/**`, `agreements/**`). New Firestore collections to rule: `design_items`, `project_tasks`, `activity`.

## 8. Success Criteria

- Manage a customer, their projects, quotes, and documents without leaving one screen.
- Every uploaded document is viewable/downloadable in the Documents tab.
- A project can hold design ideas (images + links) and a task list that drives its completion %.
- Quote acceptance flows into a project; project flows into a maintenance invoice.
- No orphaned Storage files after deletes.
