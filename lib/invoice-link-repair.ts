import { Customer } from '@/types/customer';
import { MaintenanceInvoice } from '@/types/maintenance';
import { Project } from '@/types/project';
import { resolveInvoiceClientId } from '@/lib/maintenance';

/** Issuing brands that must never be treated as customers. */
export const ISSUER_COMPANY_NAMES = new Set([
  'virtara',
  'virtec',
  'virtec projects',
  'three sixty development',
  'dylan petzer',
]);

export function normalizeIssuerOrCustomerName(value?: string | null): string {
  return (value ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isIssuerCompanyName(value?: string | null): boolean {
  const n = normalizeIssuerOrCustomerName(value);
  if (!n) return false;
  if (ISSUER_COMPANY_NAMES.has(n)) return true;
  for (const issuer of ISSUER_COMPANY_NAMES) {
    if (n === issuer || n.startsWith(`${issuer} `) || n.endsWith(` ${issuer}`)) return true;
  }
  return false;
}

export interface InvoiceCustomerLinkPatch {
  invoiceId: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  matchSource: 'clientId' | 'project' | 'clientName' | 'company';
}

type InvoiceLike = Pick<
  MaintenanceInvoice,
  'id' | 'clientId' | 'projectId' | 'company'
> & {
  clientName?: string | null;
};

function customerDisplayName(customer: Customer): string {
  return (customer.companyName || customer.name || '').trim();
}

function buildCustomerNameIndex(customers: Customer[]) {
  const byName = new Map<string, Customer>();
  for (const customer of customers) {
    if (!customer.id) continue;
    for (const raw of [customer.companyName, customer.name]) {
      const key = normalizeIssuerOrCustomerName(raw);
      if (!key || isIssuerCompanyName(key)) continue;
      if (!byName.has(key)) byName.set(key, customer);
    }
  }
  return byName;
}

/**
 * Propose Firestore patches that attach unpaid/orphan invoices to real customers.
 * Does not write — callers apply updateDoc themselves.
 */
export function proposeInvoiceCustomerLinks(
  invoices: InvoiceLike[],
  customers: Customer[],
  projects: Project[]
): InvoiceCustomerLinkPatch[] {
  const customersById = new Map(
    customers.filter((c) => c.id).map((c) => [c.id as string, c])
  );
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const byName = buildCustomerNameIndex(customers);
  const patches: InvoiceCustomerLinkPatch[] = [];

  for (const invoice of invoices) {
    const existing = resolveInvoiceClientId(invoice, projectsById, customers);
    if (existing) {
      const stored = (invoice.clientId ?? '').toString().trim();
      if (stored) continue;
      const customer = customersById.get(existing);
      if (!customer?.id) continue;
      const project = projectsById.get((invoice.projectId ?? '').toString().trim());
      patches.push({
        invoiceId: invoice.id,
        clientId: customer.id,
        clientName: customerDisplayName(customer),
        ...(project?.id ? { projectId: project.id } : {}),
        matchSource: project?.clientId === customer.id ? 'project' : 'clientName',
      });
      continue;
    }

    const candidates = [invoice.clientName, invoice.company];
    let matched: Customer | undefined;
    let source: InvoiceCustomerLinkPatch['matchSource'] = 'clientName';
    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i];
      if (!raw || isIssuerCompanyName(raw)) continue;
      const hit = byName.get(normalizeIssuerOrCustomerName(raw));
      if (hit?.id) {
        matched = hit;
        source = i === 0 ? 'clientName' : 'company';
        break;
      }
    }
    if (!matched?.id) continue;

    const projectId = (invoice.projectId ?? '').toString().trim();
    patches.push({
      invoiceId: invoice.id,
      clientId: matched.id,
      clientName: customerDisplayName(matched),
      ...(projectId ? { projectId } : {}),
      matchSource: source,
    });
  }

  return patches;
}
