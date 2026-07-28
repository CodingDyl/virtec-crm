import { Timestamp } from "firebase/firestore";

export type ExpenseCategory =
  | 'software'
  | 'hosting'
  | 'hardware'
  | 'contractors'
  | 'marketing'
  | 'travel'
  | 'fees'
  | 'office'
  | 'professional'
  | 'education'
  | 'other';

/** How often the cost repeats. `none` is a once-off purchase. */
export type ExpenseRecurrence = 'none' | 'monthly' | 'quarterly' | 'annually';

export type PaymentMethod = 'card' | 'eft' | 'debit-order' | 'cash' | 'other';

export interface Expense {
  id: string;
  vendor: string;
  description: string;
  category: ExpenseCategory;
  /** Amount actually paid, in Rands. */
  amount: number;
  /** Whether `amount` already includes VAT. */
  vatIncluded: boolean;
  /** 0.15 for standard-rated, 0 for a supplier that doesn't charge VAT. */
  vatRate: number;
  paymentMethod: PaymentMethod;
  recurrence: ExpenseRecurrence;
  /** Recharged to a client rather than absorbed. */
  billable: boolean;
  taxDeductible: boolean;
  /** Set when the cost belongs to a specific job — drives project margin. */
  projectId: string | null;
  clientId: string | null;
  receiptUrl: string | null;
  receiptPath: string | null;
  /** Date the money left the account. */
  date: Timestamp | Date | null;
  createdAt?: any;
  updatedAt?: any;
}

/** A new expense before Firestore assigns it an id. */
export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export const EXPENSE_CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  /** Shown as helper text so categorising stays consistent over time. */
  hint: string;
}[] = [
  { value: 'software', label: 'Software & subscriptions', hint: 'Figma, Adobe, AI tools, SaaS seats' },
  { value: 'hosting', label: 'Hosting & domains', hint: 'Firebase, Vercel, registrars, SSL' },
  { value: 'hardware', label: 'Hardware & equipment', hint: 'Laptops, monitors, phones, peripherals' },
  { value: 'contractors', label: 'Contractors & freelancers', hint: 'Sub-contracted design or dev work' },
  { value: 'marketing', label: 'Marketing & advertising', hint: 'Ads, sponsorships, print, content' },
  { value: 'travel', label: 'Travel & vehicle', hint: 'Fuel, tolls, client visits, parking' },
  { value: 'fees', label: 'Bank charges & fees', hint: 'Bank fees, Stripe/PayFast fees, forex' },
  { value: 'office', label: 'Office & utilities', hint: 'Rent, fibre, electricity, coffee' },
  { value: 'professional', label: 'Professional services', hint: 'Accountant, lawyer, CIPC filings' },
  { value: 'education', label: 'Learning & training', hint: 'Courses, books, conferences' },
  { value: 'other', label: 'Other', hint: "Anything that doesn't fit above" },
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = EXPENSE_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<ExpenseCategory, string>
);

export const RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  none: 'Once-off',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  eft: 'EFT',
  'debit-order': 'Debit order',
  cash: 'Cash',
  other: 'Other',
};
