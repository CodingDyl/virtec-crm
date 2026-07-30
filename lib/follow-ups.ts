import { format } from 'date-fns';
import { toDate } from '@/lib/firestore-schema';
import { formatRand } from '@/lib/maintenance';
import { FollowUp, FollowUpType } from '@/types/follow-up';

type AnyRecord = Record<string, any>;

export const FOLLOW_UP_COLLECTION = 'follow_ups';

export function normalizeFollowUp(id: string, data: AnyRecord): FollowUp {
  return {
    id,
    type: (data.type ?? 'project_stale') as FollowUp['type'],
    status: (data.status ?? 'open') as FollowUp['status'],
    customerId: data.customerId ?? undefined,
    customerName: data.customerName ?? 'Unknown customer',
    companyName: data.companyName ?? undefined,
    customerEmail: data.customerEmail ?? undefined,
    customerPhone: data.customerPhone ?? undefined,
    projectId: data.projectId ?? undefined,
    projectName: data.projectName ?? undefined,
    quoteId: data.quoteId ?? undefined,
    invoiceId: data.invoiceId ?? undefined,
    invoiceNumber: data.invoiceNumber ?? undefined,
    amount: typeof data.amount === 'number' ? data.amount : undefined,
    dueAt: data.dueAt ?? null,
    snoozedUntil: data.snoozedUntil ?? undefined,
    reason: data.reason ?? '',
    suggestedSubject: data.suggestedSubject ?? undefined,
    suggestedMessage: data.suggestedMessage ?? '',
    lastSentAt: data.lastSentAt ?? undefined,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    sourceKey: data.sourceKey ?? id,
  };
}

export function createFollowUpSourceKey(
  type: FollowUpType,
  sourceId: string,
  windowKey: string
): string {
  return `${type}:${sourceId}:${windowKey}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

export function buildSuggestedFollowUpMessage(args: {
  type: FollowUpType;
  customerName: string;
  projectName?: string;
  invoiceNumber?: string;
  amount?: number;
}): { subject: string; message: string } {
  const name = firstName(args.customerName);
  const projectName = args.projectName || 'the project';

  switch (args.type) {
    case 'quote_pending':
      return {
        subject: `Following up on ${projectName}`,
        message: `Hi ${name}, just checking whether you had a chance to review the quote for ${projectName}. I can help with any questions or adjustments.`,
      };
    case 'agreement_pending':
      return {
        subject: `Agreement for ${projectName}`,
        message: `Hi ${name}, just following up on the agreement for ${projectName}. Once it is approved/signed, we can keep things moving.`,
      };
    case 'invoice_overdue':
      return {
        subject: `Outstanding invoice ${args.invoiceNumber ?? ''}`.trim(),
        message: `Hi ${name}, just a reminder that invoice ${args.invoiceNumber ?? 'the recent invoice'} for ${formatRand(args.amount ?? 0)} is still outstanding. Please let me know if you need anything from my side.`,
      };
    case 'maintenance_renewal':
      return {
        subject: `Maintenance renewal for ${projectName}`,
        message: `Hi ${name}, your monthly maintenance period for ${projectName} is coming up. I will prepare the next invoice unless anything needs to change.`,
      };
    case 'project_stale':
    default:
      return {
        subject: `Project check-in: ${projectName}`,
        message: 'Project has had no recorded movement for 7 days. Check whether the client, design, development, or billing side is blocking progress.',
      };
  }
}

export function getFollowUpDisplayMeta(type: FollowUpType): {
  label: string;
  tone: string;
  channel: 'Email' | 'Manual';
} {
  switch (type) {
    case 'quote_pending':
      return { label: 'Pending quote', tone: 'bg-blue-500', channel: 'Email' };
    case 'agreement_pending':
      return { label: 'Unsigned agreement', tone: 'bg-yellow-500', channel: 'Email' };
    case 'invoice_overdue':
      return { label: 'Overdue invoice', tone: 'bg-red-500', channel: 'Email' };
    case 'maintenance_renewal':
      return { label: 'Maintenance renewal', tone: 'bg-green-500', channel: 'Email' };
    case 'project_stale':
    default:
      return { label: 'Stale project', tone: 'bg-slate-500', channel: 'Manual' };
  }
}

export function isFollowUpCurrentlyOpen(followUp: FollowUp, now = new Date()): boolean {
  if (followUp.status === 'open') return true;
  if (followUp.status !== 'snoozed') return false;
  const snoozedUntil = toDate(followUp.snoozedUntil);
  return Boolean(snoozedUntil && snoozedUntil.getTime() <= now.getTime());
}

export function effectiveDueDate(followUp: FollowUp): Date | null {
  if (followUp.status === 'snoozed') {
    return toDate(followUp.snoozedUntil) ?? toDate(followUp.dueAt);
  }
  return toDate(followUp.dueAt);
}

export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
