# Unified Workspace — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate Customers and Projects tabs with a single three-pane **Workspace** (Customer → Projects → Project workspace) whose Overview and Documents tabs make uploaded documents finally visible.

**Architecture:** New `components/custom-ui/workspace/` directory of focused components composed by a `Workspace` shell that holds `selectedCustomerId` / `selectedProjectId` / `activeTab` in local state. All data comes from the existing realtime contexts (`useCustomers`, `useProjects`, `useQuotes`); documents are read live per selected project via `onSnapshot`. Reuses existing `AddCustomerModal`, `AddProjectModal`, `UploadDocumentModal`, `ConfirmDialog`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Firebase Firestore + Storage, Tailwind v4, lucide-react, react-toastify.

**Testing note:** This project has no test runner and the work is Firebase-coupled UI. Verification per task = `npm run build` (Turbopack compile + TypeScript type-check) and, at the end, a browser smoke-test against live data at `http://localhost:3000/dashboard`. Commits are made on the current branch (`develop`) per project convention.

**Shared interfaces (defined once, used across tasks):**
- `WorkspaceTab = 'overview' | 'quotes' | 'documents' | 'design' | 'tasks'`
- `CustomerPane` props: `{ customers: Customer[]; selectedCustomerId: string | null; onSelect: (id: string) => void; onRefresh: () => void }`
- `CustomerHeader` props: `{ customer: Customer; projectCount: number; activeCount: number; outstandingQuoteCount: number }`
- `ProjectPane` props: `{ customer: Customer | null; projects: Project[]; selectedProjectId: string | null; onSelect: (id: string) => void; header: React.ReactNode; onRefresh: () => void }`
- `OverviewTab` props: `{ project: Project; customers: Customer[] }`
- `DocumentsTab` props: `{ project: Project }`
- `ProjectWorkspace` props: `{ project: Project | null; customers: Customer[]; activeTab: WorkspaceTab; onTabChange: (t: WorkspaceTab) => void }`

---

### Task 1: `CustomerHeader` — 360° summary strip

**Files:**
- Create: `components/custom-ui/workspace/CustomerHeader.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { Customer } from '@/types/customer';
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2 } from 'lucide-react';

interface CustomerHeaderProps {
  customer: Customer;
  projectCount: number;
  activeCount: number;
  outstandingQuoteCount: number;
}

export function CustomerHeader({ customer, projectCount, activeCount, outstandingQuoteCount }: CustomerHeaderProps) {
  return (
    <div className="rounded-xl border border-spaceAccent/30 bg-space1/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-spaceText">{customer.companyName || customer.name}</p>
          <p className="truncate text-sm text-spaceAlt/80">{customer.name}</p>
        </div>
        <Badge variant={customer.status ? 'default' : 'secondary'}>
          {customer.status ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-spaceText">R{(customer.totalSpent ?? 0).toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Total value</p>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-spaceText">{activeCount}<span className="text-spaceAlt/60 text-sm">/{projectCount}</span></p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Active proj.</p>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-yellow-400">{outstandingQuoteCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Pending quotes</p>
        </div>
      </div>

      <div className="space-y-1 text-sm text-spaceAlt/90">
        {customer.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{customer.email}</span></p>}
        {customer.contactNumber && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.contactNumber}</p>}
        {customer.companyName && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 shrink-0" />{customer.companyName}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (compiles, TypeScript finishes with no error).

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/CustomerHeader.tsx
git commit -m "feat(workspace): add CustomerHeader 360 summary"
```

---

### Task 2: `CustomerPane` — searchable customer list (left pane)

**Files:**
- Create: `components/custom-ui/workspace/CustomerPane.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useMemo, useState } from 'react';
import { Customer } from '@/types/customer';
import { Input } from "@/components/ui/input";
import { AddCustomerModal } from "../add-customer-modal";
import { Search } from 'lucide-react';

interface CustomerPaneProps {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function CustomerPane({ customers, selectedCustomerId, onSelect, onRefresh }: CustomerPaneProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter((c) =>
      `${c.name} ${c.companyName} ${c.email}`.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-spaceText">Customers</p>
        <AddCustomerModal onCustomerAdded={onRefresh} />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spaceAlt/80" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">No customers found.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => c.id && onSelect(c.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                c.id === selectedCustomerId
                  ? 'border border-spaceAccent bg-spaceAccent/15 text-spaceText'
                  : 'text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
              }`}
            >
              <span className="block truncate font-medium">{c.companyName || c.name}</span>
              <span className="block truncate text-xs text-spaceAlt/70">{c.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/CustomerPane.tsx
git commit -m "feat(workspace): add CustomerPane list with search"
```

---

### Task 3: `ProjectPane` — projects for the selected customer (middle pane)

**Files:**
- Create: `components/custom-ui/workspace/ProjectPane.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { Customer } from '@/types/customer';
import { Project } from '@/types/project';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddProjectModal } from "../add-project-modal";

interface ProjectPaneProps {
  customer: Customer | null;
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  header: React.ReactNode;
  onRefresh: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-blue-500';
    case 'on-hold': return 'bg-gray-500';
    case 'completed': return 'bg-green-500';
    default: return 'bg-blue-500';
  }
}

export function ProjectPane({ customer, projects, selectedProjectId, onSelect, header, onRefresh }: ProjectPaneProps) {
  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
        Select a customer to see their projects.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {header}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-spaceText">Projects</p>
        <AddProjectModal onProjectAdded={onRefresh} />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {projects.length === 0 ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">No projects for this customer yet.</p>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                p.id === selectedProjectId
                  ? 'border-spaceAccent bg-spaceAccent/15'
                  : 'border-spaceAccent/25 hover:bg-space1/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-spaceText">{p.projectType}</span>
                <Badge className={`text-white capitalize ${statusColor(p.status)}`}>{p.status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={p.completion} className="h-1.5 bg-space1" />
                <span className="text-xs text-spaceAlt/80">{p.completion}%</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/ProjectPane.tsx
git commit -m "feat(workspace): add ProjectPane list for selected customer"
```

---

### Task 4: `DocumentsTab` — live document list with upload & delete

**Files:**
- Create: `components/custom-ui/workspace/DocumentsTab.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { BusinessDocument, DOCUMENT_TYPE_LABELS } from '@/types/document';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadDocumentModal } from "../upload-document-modal";
import { ConfirmDialog } from "../confirm-dialog";
import { toast } from 'react-toastify';
import { FileText, ExternalLink, Trash2 } from 'lucide-react';

interface DocumentsTabProps {
  project: Project;
}

export function DocumentsTab({ project }: DocumentsTabProps) {
  const [docs, setDocs] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BusinessDocument | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'documents'), where('linkedId', '==', project.id)),
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BusinessDocument[]);
        setLoading(false);
      },
      (err) => { console.error('documents snapshot error', err); setLoading(false); }
    );
    return unsub;
  }, [project.id]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.storagePath) {
        try { await deleteObject(ref(storage, deleteTarget.storagePath)); } catch { /* already gone */ }
      }
      await deleteDoc(doc(db, 'documents', deleteTarget.id));
      if (deleteTarget.type === 'agreement') {
        await updateDoc(doc(db, 'projects', project.id), { agreementUrl: null, agreementStatus: null });
      }
      toast.success('Document removed.');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to remove document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-spaceText">Documents</p>
        <UploadDocumentModal project={project} />
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No documents yet. Use “Upload Document” to add a quote, letter, or agreement.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-spaceAccent/25 bg-space1/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-spaceAccent" />
                <span className="truncate text-sm text-spaceText">{d.name}</span>
                <Badge variant="secondary" className="shrink-0 capitalize">{DOCUMENT_TYPE_LABELS[d.type]}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" className="text-spaceAccent hover:text-spaceText" onClick={() => window.open(d.fileUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove document?"
        description={<>Remove <span className="text-spaceText">{deleteTarget?.name}</span> from this project?</>}
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/DocumentsTab.tsx
git commit -m "feat(workspace): add DocumentsTab with live list, upload, delete"
```

---

### Task 5: `OverviewTab` — inline-editable project header

**Files:**
- Create: `components/custom-ui/workspace/OverviewTab.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from 'react-toastify';

interface OverviewTabProps {
  project: Project;
  customers: Customer[];
}

export function OverviewTab({ project, customers }: OverviewTabProps) {
  const [form, setForm] = useState({
    projectType: project.projectType,
    clientId: project.clientId ?? '',
    clientName: project.clientName ?? '',
    status: project.status ?? 'active',
    amount: project.amount ?? 0,
    completion: project.completion ?? 0,
    agreementStatus: project.agreementStatus ?? 'pending',
  });
  const [saving, setSaving] = useState(false);

  // Re-sync the form whenever a different project is selected.
  useEffect(() => {
    setForm({
      projectType: project.projectType,
      clientId: project.clientId ?? '',
      clientName: project.clientName ?? '',
      status: project.status ?? 'active',
      amount: project.amount ?? 0,
      completion: project.completion ?? 0,
      agreementStatus: project.agreementStatus ?? 'pending',
    });
  }, [project.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const selected = customers.find((c) => c.id === form.clientId);
      await updateDoc(doc(db, 'projects', project.id), {
        projectType: form.projectType,
        clientId: form.clientId,
        clientName: selected?.companyName ?? form.clientName,
        status: form.status,
        amount: form.amount,
        completion: form.completion,
        agreementStatus: form.agreementStatus,
      });
      toast.success('Project updated.');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-spaceText">Project Type</label>
        <Input
          value={form.projectType}
          onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))}
          className="bg-space1 border-spaceAccent text-spaceText"
        />
      </div>

      <div>
        <label className="text-sm text-spaceText">Client</label>
        <select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} className={selectClass}>
          <option value="">{form.clientName ? `${form.clientName} (unlinked)` : 'Select a client'}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-spaceText">Status</label>
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={selectClass}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-spaceText">Amount (R)</label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, '')) : 0 }))}
            className="bg-space1 border-spaceAccent text-spaceText"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-spaceText">Completion (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={form.completion}
            onChange={(e) => setForm((p) => ({ ...p, completion: Number(e.target.value) }))}
            className="bg-space1 border-spaceAccent text-spaceText"
          />
        </div>
        <div>
          <label className="text-sm text-spaceText">Agreement Status</label>
          <select value={form.agreementStatus} onChange={(e) => setForm((p) => ({ ...p, agreementStatus: e.target.value as Project['agreementStatus'] }))} className={selectClass}>
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-spaceAccent hover:bg-spaceAlt text-spaceText">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/OverviewTab.tsx
git commit -m "feat(workspace): add OverviewTab inline project editor"
```

---

### Task 6: `ProjectWorkspace` — tabbed right pane

**Files:**
- Create: `components/custom-ui/workspace/ProjectWorkspace.tsx`

- [ ] **Step 1: Write the component** (Overview + Documents wired; Quotes/Design/Tasks show a phase placeholder)

```tsx
'use client'

import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { OverviewTab } from './OverviewTab';
import { DocumentsTab } from './DocumentsTab';

export type WorkspaceTab = 'overview' | 'quotes' | 'documents' | 'design' | 'tasks';

interface ProjectWorkspaceProps {
  project: Project | null;
  customers: Customer[];
  activeTab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
}

const TABS: { key: WorkspaceTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'documents', label: 'Documents' },
  { key: 'design', label: 'Design' },
  { key: 'tasks', label: 'Tasks' },
];

export function ProjectWorkspace({ project, customers, activeTab, onTabChange }: ProjectWorkspaceProps) {
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
        Select a project to open its workspace.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <p className="text-base font-semibold text-spaceText">{project.projectType}</p>
        <p className="text-sm text-spaceAlt/80">{project.clientName}</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-spaceAccent/20 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              t.key === activeTab
                ? 'bg-spaceAccent text-space1 font-medium'
                : 'text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === 'overview' && <OverviewTab project={project} customers={customers} />}
        {activeTab === 'documents' && <DocumentsTab project={project} />}
        {(activeTab === 'quotes' || activeTab === 'design' || activeTab === 'tasks') && (
          <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/60">
            This tab arrives in a later phase.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/ProjectWorkspace.tsx
git commit -m "feat(workspace): add ProjectWorkspace tab container"
```

---

### Task 7: `Workspace` — three-pane shell with selection state

**Files:**
- Create: `components/custom-ui/workspace/Workspace.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react';
import { useCustomers, useProjects, useQuotes } from '@/contexts/DataContexts';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { CustomerPane } from './CustomerPane';
import { CustomerHeader } from './CustomerHeader';
import { ProjectPane } from './ProjectPane';
import { ProjectWorkspace, WorkspaceTab } from './ProjectWorkspace';

export default function Workspace() {
  const { customers, isLoading: customersLoading, refreshData: refreshCustomers } = useCustomers();
  const { projects, refreshData: refreshProjects } = useProjects();
  const { quotes } = useQuotes();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const customerProjects = useMemo(
    () => (selectedCustomerId ? projects.filter((p) => p.clientId === selectedCustomerId) : []),
    [projects, selectedCustomerId]
  );

  const selectedProject = useMemo(
    () => customerProjects.find((p) => p.id === selectedProjectId) ?? null,
    [customerProjects, selectedProjectId]
  );

  // Pending quotes for this customer's projects.
  const outstandingQuoteCount = useMemo(() => {
    const ids = new Set(customerProjects.map((p) => p.id));
    return quotes.filter((q) => {
      const pid = (q as any).projectId ?? (q as any).project_id;
      return ids.has(pid) && q.status === 'pending';
    }).length;
  }, [quotes, customerProjects]);

  // Clear the project selection when switching customers.
  useEffect(() => {
    setSelectedProjectId(null);
    setActiveTab('overview');
  }, [selectedCustomerId]);

  if (customersLoading) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-4">
        <Quantum size="100" speed="1.75" color="white" />
        <p className="text-spaceText">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[260px_320px_1fr]">
      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <CustomerPane
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={setSelectedCustomerId}
          onRefresh={refreshCustomers}
        />
      </div>

      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <ProjectPane
          customer={selectedCustomer}
          projects={customerProjects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onRefresh={refreshProjects}
          header={
            selectedCustomer ? (
              <CustomerHeader
                customer={selectedCustomer}
                projectCount={customerProjects.length}
                activeCount={customerProjects.filter((p) => p.status === 'active').length}
                outstandingQuoteCount={outstandingQuoteCount}
              />
            ) : null
          }
        />
      </div>

      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <ProjectWorkspace
          project={selectedProject}
          customers={customers}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/custom-ui/workspace/Workspace.tsx
git commit -m "feat(workspace): add three-pane Workspace shell"
```

---

### Task 8: Wire Workspace into the dashboard; retire Customers/Projects tabs

**Files:**
- Modify: `components/dashboard.tsx`
- Modify: `components/custom-ui/navbar.tsx`

- [ ] **Step 1: Add the dynamic import in `components/dashboard.tsx`**

Replace the two lines:

```tsx
const ProjectsTable = dynamic(() => import('./custom-ui/projects-table'), {
  loading: () => <div>Loading...</div>
})
const CustomersTable = dynamic(() => import('./custom-ui/customers-table'), {
  loading: () => <div>Loading...</div>
})
```

with:

```tsx
const Workspace = dynamic(() => import('./custom-ui/workspace/Workspace'), {
  loading: () => <div>Loading...</div>
})
```

- [ ] **Step 2: Replace the Customers and Projects tab triggers in `components/dashboard.tsx`**

Replace:

```tsx
              <TabsTrigger value="customers" onClick={() => setActiveTab('customers')}>Customers</TabsTrigger>
              <TabsTrigger value="projects" onClick={() => setActiveTab('projects')}>Projects</TabsTrigger>
```

with:

```tsx
              <TabsTrigger value="workspace" onClick={() => setActiveTab('workspace')}>Workspace</TabsTrigger>
```

- [ ] **Step 3: Replace the Customers and Projects tab panels in `components/dashboard.tsx`**

Replace:

```tsx
            <TabsContent value="customers" className="space-y-4">
              <CustomersTable />
            </TabsContent>
            <TabsContent value="projects" className="space-y-4">
              <ProjectsTable />
            </TabsContent>
```

with:

```tsx
            <TabsContent value="workspace" className="space-y-4">
              <Workspace />
            </TabsContent>
```

- [ ] **Step 4: Update the default tab in `components/dashboard.tsx`**

Replace:

```tsx
  const [activeTab, setActiveTab] = useState('overview')
```

(leave as `'overview'` — no change needed; Overview stays the landing tab.)

- [ ] **Step 5: Replace the Customers and Projects buttons in `components/custom-ui/navbar.tsx`**

Replace the two `<Button>` blocks for `'customers'` and `'projects'` (the block starting `activeTab === 'customers'` through the end of the `'projects'` button) with a single Workspace button:

```tsx
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'workspace' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('workspace')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Workspace
            </Button>
```

- [ ] **Step 6: Update the navbar icon import in `components/custom-ui/navbar.tsx`**

Replace:

```tsx
import { LayoutDashboard, Users, BarChart3, LogOut, FileText, Calculator, Mail, Lock } from "lucide-react";
```

with:

```tsx
import { LayoutDashboard, LayoutGrid, LogOut, FileText, Calculator, Mail, Lock } from "lucide-react";
```

(`Users` and `BarChart3` are no longer used.)

- [ ] **Step 7: Type-check**

Run: `npm run build`
Expected: PASS, with no "unused import" or missing-component errors.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard.tsx components/custom-ui/navbar.tsx
git commit -m "feat(workspace): replace Customers/Projects tabs with unified Workspace"
```

---

### Task 9: Browser smoke-test against live data

**Files:** none (verification only).

- [ ] **Step 1: Confirm the dev server is up**

If `http://localhost:3000/dashboard` is not already served, start it (`npm run dev`) or use the existing running server.

- [ ] **Step 2: Verify navigation**

Open `http://localhost:3000/dashboard`. Confirm the sidebar and top tabs now show **Workspace** (no Customers/Projects). Click **Workspace**.
Expected: three-pane layout renders; left pane lists customers.

- [ ] **Step 3: Verify drill-down**

Click a customer → the middle pane shows the 360° header (total value / active / pending quotes) and that customer's projects. Click a project → the right pane opens with the Overview tab.
Expected: all three panes populate; selecting a new customer clears the project selection.

- [ ] **Step 4: Verify Overview editing**

On the Overview tab, change Status to **On Hold** and click **Save changes**.
Expected: success toast; the project's badge in the middle pane updates (realtime).

- [ ] **Step 5: Verify Documents visibility**

Click the **Documents** tab → confirm previously uploaded documents for that project are listed. Click **Upload Document**, add a test letter, confirm it appears live, then delete it and confirm removal.
Expected: upload appears without refresh; delete removes it and cleans up.

- [ ] **Step 6: Check console**

Confirm no errors in the browser console (`read_console_messages` onlyErrors, or DevTools).
Expected: clean.

- [ ] **Step 7: Final commit (if any doc/config tweaks were needed)**

```bash
git add -A
git commit -m "test(workspace): verify Phase 1 three-pane flow"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- Three-pane shell → Task 7. ✅
- CustomerPane → Task 2. ✅
- ProjectPane + CustomerHeader → Tasks 1, 3. ✅
- OverviewTab (inline edit: status incl. on-hold, amount, client re-link, agreement) → Task 5. ✅
- DocumentsTab (view/download/delete uploaded docs — fixes visibility) → Task 4. ✅
- Replace Customers/Projects tabs with Workspace → Task 8. ✅
- Reuse existing modals/dialogs (AddCustomerModal, AddProjectModal, UploadDocumentModal, ConfirmDialog) → Tasks 2, 3, 4. ✅

**Deferred to later phases (correctly out of Phase 1):** QuotesTab, DesignTab, TasksTab, activity timeline, health badges, command search, safe-delete sweep — all shown as placeholders or untouched.

**Placeholder scan:** No TBD/TODO; every component is complete code.

**Type consistency:** `WorkspaceTab` defined in `ProjectWorkspace.tsx` and imported by `Workspace.tsx`. Prop shapes match the "Shared interfaces" block. `useCustomers/useProjects/useQuotes` return shapes match `contexts/DataContexts.tsx`. `Project.clientId`, `Project.amount`, `agreementStatus` union all exist in `types/project.ts`. `UploadDocumentModal` (`{ project }`) and `ConfirmDialog` props match their definitions.

**Note on old files:** `customers-table.tsx` and `projects-table.tsx` are left on disk but no longer imported after Task 8. Removing them is deferred until Phase 1 is verified in production, to keep an easy rollback.
