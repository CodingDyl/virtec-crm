import { Expense, ExpenseCategory, ExpenseRecurrence } from '@/types/expense';
import { toDate, pickNumber } from '@/lib/firestore-schema';

/** South African standard VAT rate. */
export const VAT_RATE = 0.15;

/** How many times a year each recurrence is paid. */
const PER_YEAR: Record<ExpenseRecurrence, number> = {
  none: 0,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

export function normalizeExpense(id: string, data: Record<string, any>): Expense {
  return {
    id,
    vendor: data.vendor ?? '',
    description: data.description ?? '',
    category: (data.category ?? 'other') as ExpenseCategory,
    amount: pickNumber(data, ['amount'], 0),
    vatIncluded: data.vatIncluded ?? true,
    vatRate: pickNumber(data, ['vatRate'], VAT_RATE),
    paymentMethod: data.paymentMethod ?? 'card',
    recurrence: (data.recurrence ?? 'none') as ExpenseRecurrence,
    billable: data.billable ?? false,
    taxDeductible: data.taxDeductible ?? true,
    projectId: data.projectId ?? null,
    clientId: data.clientId ?? null,
    receiptUrl: data.receiptUrl ?? null,
    receiptPath: data.receiptPath ?? null,
    date: data.date ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * The VAT portion of an expense — what you can claim back as input VAT.
 * When the amount excludes VAT the portion sits on top of it instead of inside it.
 */
export function vatPortion(expense: Pick<Expense, 'amount' | 'vatIncluded' | 'vatRate'>): number {
  const { amount, vatIncluded, vatRate } = expense;
  if (!vatRate) return 0;
  return vatIncluded ? amount - amount / (1 + vatRate) : amount * vatRate;
}

/** Total cash out the door, whether or not the captured amount included VAT. */
export function grossAmount(expense: Pick<Expense, 'amount' | 'vatIncluded' | 'vatRate'>): number {
  return expense.vatIncluded ? expense.amount : expense.amount * (1 + (expense.vatRate || 0));
}

/** Amount excluding VAT — the figure that belongs in the income statement. */
export function netAmount(expense: Pick<Expense, 'amount' | 'vatIncluded' | 'vatRate'>): number {
  return grossAmount(expense) - vatPortion(expense);
}

/**
 * What a recurring cost works out to per month. Once-off costs return 0 —
 * they're real spend, but they aren't part of the fixed monthly burn.
 */
export function monthlyEquivalent(expense: Pick<Expense, 'amount' | 'vatIncluded' | 'vatRate' | 'recurrence'>): number {
  const perYear = PER_YEAR[expense.recurrence];
  if (!perYear) return 0;
  return (grossAmount(expense) * perYear) / 12;
}

/** Advance a date by one recurrence step. */
function step(date: Date, recurrence: ExpenseRecurrence): Date {
  const next = new Date(date);
  switch (recurrence) {
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    case 'annually': next.setFullYear(next.getFullYear() + 1); break;
    default: return next;
  }
  return next;
}

/**
 * The next date a recurring expense will be charged, rolled forward from the
 * last recorded payment. Returns null for once-off costs.
 */
export function nextChargeDate(expense: Pick<Expense, 'date' | 'recurrence'>, from: Date = new Date()): Date | null {
  if (expense.recurrence === 'none') return null;
  const start = toDate(expense.date);
  if (!start) return null;

  let next = new Date(start);
  // Guard the loop: 400 steps covers a monthly charge dated 30+ years ago.
  for (let i = 0; i < 400 && next < from; i++) {
    next = step(next, expense.recurrence);
  }
  return next;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(from)) / 86_400_000);
}

/**
 * The South African tax year containing `date`: 1 March through end of February.
 */
export function taxYearRange(date: Date = new Date()): { start: Date; end: Date; label: string } {
  const startYear = date.getMonth() >= 2 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    start: new Date(startYear, 2, 1),
    end: new Date(startYear + 1, 1, 29, 23, 59, 59, 999),
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
  };
}

export function isWithin(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

export function monthRange(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/** Rands, no cents — matches how the rest of the CRM shows money. */
export function formatZAR(value: number): string {
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

/** Rands with cents, for single-line-item precision. */
export function formatZARExact(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number;
  count: number;
  share: number;
}

export function totalsByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, { total: number; count: number }>();
  expenses.forEach((e) => {
    const current = totals.get(e.category) ?? { total: 0, count: 0 };
    totals.set(e.category, { total: current.total + grossAmount(e), count: current.count + 1 });
  });

  const grand = [...totals.values()].reduce((sum, t) => sum + t.total, 0);
  return [...totals.entries()]
    .map(([category, t]) => ({
      category,
      total: t.total,
      count: t.count,
      share: grand > 0 ? t.total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Rolling monthly spend for the last `months` months, oldest first,
 * shaped to line up with the revenue series on the Overview dashboard.
 */
export function monthlySpendSeries(expenses: Expense[], months = 6, from: Date = new Date()) {
  return Array.from({ length: months }, (_, index) => {
    const cursor = new Date(from.getFullYear(), from.getMonth() - (months - 1 - index), 1);
    const total = expenses.reduce((sum, expense) => {
      const date = toDate(expense.date);
      if (!date || date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
        return sum;
      }
      return sum + grossAmount(expense);
    }, 0);

    return { name: cursor.toLocaleString('default', { month: 'short' }), total };
  });
}
