import { Project } from '@/types/project';
import {
  MaintenanceFrequency,
  MaintenanceInvoice,
  MaintenanceSummary,
} from '@/types/maintenance';
import { pickNumber, pickValue, toDate } from '@/lib/firestore-schema';

type AnyRecord = Record<string, any>;

export const MAINTENANCE_FREQUENCIES: {
  value: MaintenanceFrequency;
  label: string;
  /** Months between invoices. Null for ad-hoc, which has no schedule. */
  months: number | null;
}[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'biannual', label: 'Every 6 months', months: 6 },
  { value: 'annual', label: 'Annually', months: 12 },
  { value: 'ad-hoc', label: 'Ad-hoc (no schedule)', months: null },
];

export const DEFAULT_MAINTENANCE_FREQUENCY: MaintenanceFrequency = 'monthly';

export function frequencyLabel(frequency?: MaintenanceFrequency | null): string {
  return MAINTENANCE_FREQUENCIES.find((f) => f.value === frequency)?.label ?? 'Not set';
}

export function frequencyMonths(frequency?: MaintenanceFrequency | null): number | null {
  return MAINTENANCE_FREQUENCIES.find((f) => f.value === frequency)?.months ?? null;
}

/** How many billing cycles a frequency produces in a year. Ad-hoc yields 0. */
export function cyclesPerYear(frequency?: MaintenanceFrequency | null): number {
  const months = frequencyMonths(frequency);
  return months ? 12 / months : 0;
}

/**
 * A project counts as maintenance when it is typed as such, or once it has been
 * given a billing frequency. The type check stays loose because project types
 * are free text on older records.
 */
export function isMaintenanceProject(project: Pick<Project, 'projectType'> & AnyRecord): boolean {
  const type = (project?.projectType ?? project?.project_type ?? '').toString().trim().toLowerCase();
  return type === 'maintenance' || Boolean(project?.maintenanceFrequency);
}

export function normalizeMaintenanceInvoice(id: string, data: AnyRecord): MaintenanceInvoice {
  return {
    id,
    invoiceNumber: data.invoiceNumber ?? undefined,
    projectId: pickValue<string>(data, ['projectId', 'project_id'], ''),
    clientId: pickValue<string>(data, ['clientId', 'client_id'], ''),
    company: data.company ?? '',
    date: data.date ?? null,
    hourlyRate: pickNumber(data, ['hourlyRate', 'hourly_rate'], 0),
    items: Array.isArray(data.items) ? data.items : [],
    totalAmount: pickNumber(data, ['totalAmount', 'total_amount'], 0),
    pdfUrl: pickValue<string>(data, ['pdfUrl', 'pdf_url'], ''),
    pdfPath: pickValue<string>(data, ['pdfPath'], ''),
    status: (data.status ?? 'pending') as MaintenanceInvoice['status'],
  };
}

/** Human label for an invoice with no explicit number. */
export function invoiceLabel(invoice: Pick<MaintenanceInvoice, 'id' | 'invoiceNumber'>): string {
  return invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
}

const EMPTY_SUMMARY: MaintenanceSummary = {
  totalPaid: 0,
  outstanding: 0,
  invoiceCount: 0,
  paidCount: 0,
  lastPaidAt: null,
  lastInvoicedAt: null,
};

/** Roll a set of invoices into the billing position they represent. */
export function summariseMaintenance(invoices: MaintenanceInvoice[]): MaintenanceSummary {
  return invoices.reduce<MaintenanceSummary>((acc, invoice) => {
    const issued = toDate(invoice.date);
    const paid = invoice.status === 'paid';

    return {
      totalPaid: acc.totalPaid + (paid ? invoice.totalAmount : 0),
      outstanding: acc.outstanding + (paid ? 0 : invoice.totalAmount),
      invoiceCount: acc.invoiceCount + 1,
      paidCount: acc.paidCount + (paid ? 1 : 0),
      lastPaidAt:
        paid && issued && (!acc.lastPaidAt || issued > acc.lastPaidAt) ? issued : acc.lastPaidAt,
      lastInvoicedAt:
        issued && (!acc.lastInvoicedAt || issued > acc.lastInvoicedAt) ? issued : acc.lastInvoicedAt,
    };
  }, { ...EMPTY_SUMMARY });
}

/**
 * When the next invoice is due: one cycle on from the most recent one. Returns
 * null for ad-hoc projects and for projects that have never been invoiced,
 * because neither has a schedule to project forward from.
 */
export function nextDueDate(
  frequency: MaintenanceFrequency | undefined | null,
  lastInvoicedAt: Date | null
): Date | null {
  const months = frequencyMonths(frequency);
  if (!months || !lastInvoicedAt) return null;

  const due = new Date(lastInvoicedAt);
  due.setMonth(due.getMonth() + months);
  return due;
}

export function formatRand(amount: number): string {
  return `R${Math.round(amount).toLocaleString('en-ZA')}`;
}
