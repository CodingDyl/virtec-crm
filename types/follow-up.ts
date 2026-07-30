export type FollowUpType =
  | 'quote_pending'
  | 'agreement_pending'
  | 'invoice_overdue'
  | 'maintenance_renewal'
  | 'project_stale';

export type FollowUpStatus = 'open' | 'sent' | 'dismissed' | 'snoozed';

export interface FollowUp {
  id: string;
  type: FollowUpType;
  status: FollowUpStatus;
  customerId?: string;
  customerName: string;
  companyName?: string;
  customerEmail?: string;
  customerPhone?: string;
  projectId?: string;
  projectName?: string;
  quoteId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  dueAt: any;
  snoozedUntil?: any;
  reason: string;
  suggestedSubject?: string;
  suggestedMessage: string;
  lastSentAt?: any;
  createdAt: any;
  updatedAt: any;
  sourceKey: string;
}
