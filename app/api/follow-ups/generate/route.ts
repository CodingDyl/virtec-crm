import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getOperator } from '@/lib/auth-server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  FOLLOW_UP_COLLECTION,
  buildSuggestedFollowUpMessage,
  createFollowUpSourceKey,
  dayKey,
} from '@/lib/follow-ups';
import { FollowUpType } from '@/types/follow-up';

type AnyRecord = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function ageInDays(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function frequencyMonths(frequency: string | undefined): number | null {
  switch (frequency) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'biannual': return 6;
    case 'annual': return 12;
    default: return null;
  }
}

function isMaintenanceProject(project: AnyRecord): boolean {
  const type = (project.projectType ?? project.project_type ?? '').toString().toLowerCase();
  return type === 'maintenance' || Boolean(project.maintenanceFrequency);
}

function isCompletedOrCancelled(status: any): boolean {
  const value = (status ?? '').toString().trim().toLowerCase();
  return ['completed', 'complete', 'cancelled', 'canceled'].includes(value);
}

function isActiveProject(status: any): boolean {
  const value = (status ?? '').toString().trim().toLowerCase();
  return ['active', 'in progress', 'in-progress', 'progress'].includes(value);
}

function getCustomer(
  customersById: Map<string, AnyRecord>,
  customerId?: string,
  fallbackName?: string
) {
  const customer = customerId ? customersById.get(customerId) : undefined;
  return {
    id: customerId,
    name: customer?.name ?? fallbackName ?? 'Unknown customer',
    companyName: customer?.companyName ?? customer?.company ?? '',
    email: customer?.email ?? '',
    phone: customer?.contactNumber ?? customer?.phone ?? '',
  };
}

function invoiceLabel(invoice: AnyRecord, invoiceId: string): string {
  return invoice.invoiceNumber || `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
}

function candidateBase(args: {
  type: FollowUpType;
  customer: ReturnType<typeof getCustomer>;
  project?: AnyRecord & { id: string };
  quoteId?: string;
  invoice?: AnyRecord & { id: string };
  amount?: number;
  dueAt: Date;
  reason: string;
  sourceKey: string;
}) {
  const projectName = args.project?.projectType ?? args.project?.project_type ?? args.project?.clientName;
  const invoiceNumber = args.invoice ? invoiceLabel(args.invoice, args.invoice.id) : undefined;
  const message = buildSuggestedFollowUpMessage({
    type: args.type,
    customerName: args.customer.name,
    projectName,
    invoiceNumber,
    amount: args.amount,
  });

  const candidate = {
    type: args.type,
    status: 'open',
    customerId: args.customer.id,
    customerName: args.customer.name,
    companyName: args.customer.companyName,
    customerEmail: args.customer.email,
    customerPhone: args.customer.phone,
    projectId: args.project?.id,
    projectName,
    quoteId: args.quoteId,
    invoiceId: args.invoice?.id,
    invoiceNumber,
    amount: args.amount,
    dueAt: args.dueAt,
    reason: args.reason,
    suggestedSubject: message.subject,
    suggestedMessage: message.message,
    sourceKey: args.sourceKey,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  return Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value !== undefined)
  );
}

export async function POST() {
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);

    const [
      customersSnap,
      projectsSnap,
      quotesSnap,
      invoicesSnap,
      followUpsSnap,
      activitySnap,
      tasksSnap,
    ] = await Promise.all([
      db.collection('customers').get(),
      db.collection('projects').get(),
      db.collection('quotes').get(),
      db.collection('maintenance_invoices').get(),
      db.collection(FOLLOW_UP_COLLECTION).get(),
      db.collection('activity').get(),
      db.collection('project_tasks').get(),
    ]);

    const customersById = new Map(customersSnap.docs.map((item) => [item.id, item.data() as AnyRecord]));
    const projectsById = new Map<string, AnyRecord & { id: string }>(
      projectsSnap.docs.map((item) => [item.id, { id: item.id, ...(item.data() as AnyRecord) }])
    );
    const existingSourceKeys = new Set(
      followUpsSnap.docs
        .map((item) => item.data().sourceKey)
        .filter((sourceKey): sourceKey is string => typeof sourceKey === 'string' && sourceKey.length > 0)
    );

    const latestActivityByProject = new Map<string, Date>();
    activitySnap.docs.forEach((item) => {
      const data = item.data();
      if (data.refType !== 'project' || !data.refId) return;
      const createdAt = asDate(data.createdAt);
      if (!createdAt) return;
      const current = latestActivityByProject.get(data.refId);
      if (!current || createdAt > current) latestActivityByProject.set(data.refId, createdAt);
    });

    tasksSnap.docs.forEach((item) => {
      const data = item.data();
      if (!data.projectId) return;
      const createdAt = asDate(data.updatedAt ?? data.createdAt);
      if (!createdAt) return;
      const current = latestActivityByProject.get(data.projectId);
      if (!current || createdAt > current) latestActivityByProject.set(data.projectId, createdAt);
    });

    const invoices: (AnyRecord & { id: string })[] = invoicesSnap.docs.map((item) => ({
      id: item.id,
      ...(item.data() as AnyRecord),
    }));
    const invoicesByProject = new Map<string, (AnyRecord & { id: string })[]>();
    invoices.forEach((invoice) => {
      if (!invoice.projectId) return;
      const rows = invoicesByProject.get(invoice.projectId) ?? [];
      rows.push(invoice);
      invoicesByProject.set(invoice.projectId, rows);
    });

    const candidates: AnyRecord[] = [];

    quotesSnap.docs.forEach((item) => {
      const quote = item.data() as AnyRecord;
      if (quote.status !== 'pending') return;
      const createdAt = asDate(quote.createdAt ?? quote.created_at);
      if (!createdAt || ageInDays(createdAt, now) < 3) return;

      const projectId = quote.projectId ?? quote.project_id;
      const project = projectId ? projectsById.get(projectId) : undefined;
      const customerId = quote.clientId ?? quote.client_id ?? project?.clientId;
      const customer = getCustomer(customersById, customerId, project?.clientName);
      const sourceKey = createFollowUpSourceKey('quote_pending', item.id, '3d');

      candidates.push(candidateBase({
        type: 'quote_pending',
        customer,
        project,
        quoteId: item.id,
        amount: Number(quote.totalAmount ?? quote.total_amount ?? 0),
        dueAt: now,
        reason: `Pending quote has had no answer for ${ageInDays(createdAt, now)} days.`,
        sourceKey,
      }));
    });

    projectsSnap.docs.forEach((item) => {
      const project: AnyRecord & { id: string } = { id: item.id, ...(item.data() as AnyRecord) };
      if ((project.agreementStatus ?? 'pending') !== 'pending') return;
      if (isCompletedOrCancelled(project.status)) return;
      const createdAt = asDate(project.createdAt ?? project.created_at);
      if (!createdAt || ageInDays(createdAt, now) < 5) return;

      const customer = getCustomer(customersById, project.clientId, project.clientName);
      const sourceKey = createFollowUpSourceKey('agreement_pending', item.id, '5d');

      candidates.push(candidateBase({
        type: 'agreement_pending',
        customer,
        project,
        dueAt: now,
        reason: `Agreement has been pending for ${ageInDays(createdAt, now)} days.`,
        sourceKey,
      }));
    });

    invoices.forEach((invoice) => {
      if (invoice.status === 'paid') return;
      const issuedAt = asDate(invoice.dueAt ?? invoice.dueDate ?? invoice.date ?? invoice.createdAt);
      if (!issuedAt || ageInDays(issuedAt, now) < 7) return;

      const project = invoice.projectId ? projectsById.get(invoice.projectId) : undefined;
      const customer = getCustomer(customersById, invoice.clientId ?? project?.clientId, project?.clientName ?? invoice.company);
      const sourceKey = createFollowUpSourceKey('invoice_overdue', invoice.id, '7d');

      candidates.push(candidateBase({
        type: 'invoice_overdue',
        customer,
        project,
        invoice,
        amount: Number(invoice.totalAmount ?? invoice.total_amount ?? 0),
        dueAt: now,
        reason: `${invoiceLabel(invoice, invoice.id)} has been outstanding for ${ageInDays(issuedAt, now)} days.`,
        sourceKey,
      }));
    });

    projectsSnap.docs.forEach((item) => {
      const project: AnyRecord & { id: string } = { id: item.id, ...(item.data() as AnyRecord) };
      if (!isMaintenanceProject(project) || isCompletedOrCancelled(project.status)) return;
      const months = frequencyMonths(project.maintenanceFrequency ?? 'monthly');
      if (!months) return;

      const projectInvoices = invoicesByProject.get(project.id) ?? [];
      const lastInvoiceDate = projectInvoices
        .map((invoice) => asDate(invoice.date ?? invoice.createdAt))
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (!lastInvoiceDate) return;

      const nextDueAt = addMonths(lastInvoiceDate, months);
      if (nextDueAt < now || nextDueAt > sevenDaysFromNow) return;

      const period = periodKey(nextDueAt);
      const hasInvoiceForPeriod = projectInvoices.some((invoice) => {
        const invoiceDate = asDate(invoice.date ?? invoice.createdAt);
        return invoiceDate ? periodKey(invoiceDate) === period : false;
      });
      if (hasInvoiceForPeriod) return;

      const customer = getCustomer(customersById, project.clientId, project.clientName);
      const sourceKey = createFollowUpSourceKey('maintenance_renewal', project.id, period);

      candidates.push(candidateBase({
        type: 'maintenance_renewal',
        customer,
        project,
        amount: Number(project.maintenanceAmount ?? 0),
        dueAt: nextDueAt,
        reason: `Maintenance renewal is due on ${dayKey(nextDueAt)}.`,
        sourceKey,
      }));
    });

    projectsSnap.docs.forEach((item) => {
      const project: AnyRecord & { id: string } = { id: item.id, ...(item.data() as AnyRecord) };
      if (!isActiveProject(project.status)) return;
      if (Number(project.completion ?? 0) >= 100) return;

      const createdAt = asDate(project.createdAt ?? project.created_at);
      const latestMovement = latestActivityByProject.get(project.id) ?? createdAt;
      if (!latestMovement || ageInDays(latestMovement, now) < 7) return;

      const customer = getCustomer(customersById, project.clientId, project.clientName);
      const sourceKey = createFollowUpSourceKey('project_stale', project.id, '7d');

      candidates.push(candidateBase({
        type: 'project_stale',
        customer,
        project,
        dueAt: now,
        reason: `Project has had no recorded movement for ${ageInDays(latestMovement, now)} days.`,
        sourceKey,
      }));
    });

    const createdByType: Partial<Record<FollowUpType, number>> = {};
    let created = 0;
    let skipped = 0;
    const batch = db.batch();

    candidates.forEach((candidate) => {
      if (existingSourceKeys.has(candidate.sourceKey)) {
        skipped += 1;
        return;
      }

      created += 1;
      createdByType[candidate.type as FollowUpType] = (createdByType[candidate.type as FollowUpType] ?? 0) + 1;
      existingSourceKeys.add(candidate.sourceKey);
      batch.set(db.collection(FOLLOW_UP_COLLECTION).doc(), candidate);
    });

    if (created > 0) {
      await batch.commit();
    }

    return NextResponse.json({ created, skipped, createdByType });
  } catch (error) {
    console.error('follow-up generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate follow-ups.' },
      { status: 500 }
    );
  }
}
