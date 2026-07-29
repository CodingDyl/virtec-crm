/**
 * A maintenance project is billed on a repeating cycle, so it accumulates many
 * invoices over its life — one per period. That one-to-many link is what
 * separates maintenance work from a normal project, which carries a single
 * quote for a single scope.
 */
export type MaintenanceFrequency =
  | 'monthly'
  | 'quarterly'
  | 'biannual'
  | 'annual'
  | 'ad-hoc';

export type MaintenanceInvoiceStatus = 'pending' | 'emailed' | 'paid' | 'overdue';

export interface MaintenanceItem {
  title: string;
  hours: number;
  amount: number;
}

export interface MaintenanceInvoice {
  id: string;
  invoiceNumber?: string;
  /** The maintenance project this invoice bills against. Empty on legacy records. */
  projectId: string;
  clientId: string;
  company: string;
  date: any; // Firestore Timestamp
  hourlyRate: number;
  items: MaintenanceItem[];
  totalAmount: number;
  /** Legacy permanent download URL. */
  pdfUrl: string;
  /** Bucket path; resolved to a signed URL on demand. */
  pdfPath?: string;
  status: MaintenanceInvoiceStatus;
}

/** Rolled-up billing position for one project, or for a customer as a whole. */
export interface MaintenanceSummary {
  /** Sum of every invoice actually settled. */
  totalPaid: number;
  /** Issued but not yet settled — pending, emailed or overdue. */
  outstanding: number;
  invoiceCount: number;
  paidCount: number;
  lastPaidAt: Date | null;
  lastInvoicedAt: Date | null;
}
