'use client'

import { useMemo, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { useExpenses, useProjects } from '@/contexts/DataContexts';
import { useDashboard } from '@/contexts/DashboardContext';
import {
  Expense,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  RECURRENCE_LABELS,
} from '@/types/expense';
import {
  daysUntil,
  formatZAR,
  grossAmount,
  isWithin,
  monthRange,
  monthlyEquivalent,
  nextChargeDate,
  taxYearRange,
  totalsByCategory,
  vatPortion,
} from '@/lib/expenses';
import { toDate } from '@/lib/firestore-schema';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from './table-pagination';
import { ExpenseModal } from './expense-modal';
import { ConfirmDialog } from './confirm-dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { Plus, Search, Paperclip, Pencil, Trash2, Repeat, WalletMinimal } from 'lucide-react';

type Period = 'month' | 'quarter' | 'tax-year' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'tax-year', label: 'This tax year' },
  { value: 'all', label: 'All time' },
];

/**
 * A sequential ramp built from the brand cyan→blue band. One hue family keeps
 * the breakdown readable as a ranking rather than a rainbow of categories.
 */
const RAMP = ['#8df6ff', '#6fc2ff', '#4ea4ff', '#3d86e0', '#2f68b8', '#24508f', '#1c3c6b'];

function rampColor(index: number): string {
  return RAMP[Math.min(index, RAMP.length - 1)];
}

function periodBounds(period: Period): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case 'month':
      return monthRange(now);
    case 'quarter':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        end: monthRange(now).end,
      };
    case 'tax-year': {
      const { start, end } = taxYearRange(now);
      return { start, end };
    }
    default:
      return null;
  }
}

export default function ExpensesSection() {
  const { expenses, isLoading } = useExpenses();
  const { projects } = useProjects();
  const { dashboardData } = useDashboard();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [period, setPeriod] = useState<Period>('tax-year');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const projectNames = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.projectType));
    return map;
  }, [projects]);

  // ── Headline figures ──────────────────────────────────────────────────────
  const thisMonth = monthRange();
  const taxYear = taxYearRange();

  const spentThisMonth = useMemo(
    () => expenses
      .filter((e) => isWithin(toDate(e.date), thisMonth.start, thisMonth.end))
      .reduce((sum, e) => sum + grossAmount(e), 0),
    [expenses, thisMonth.start, thisMonth.end]
  );

  /** Every active recurring cost, normalised to a per-month figure. */
  const fixedMonthlyBurn = useMemo(
    () => expenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0),
    [expenses]
  );

  const taxYearExpenses = useMemo(
    () => expenses.filter((e) => isWithin(toDate(e.date), taxYear.start, taxYear.end)),
    [expenses, taxYear.start, taxYear.end]
  );

  const reclaimableVat = useMemo(
    () => taxYearExpenses.reduce((sum, e) => sum + vatPortion(e), 0),
    [taxYearExpenses]
  );

  const deductibleTotal = useMemo(
    () => taxYearExpenses.filter((e) => e.taxDeductible).reduce((sum, e) => sum + grossAmount(e), 0),
    [taxYearExpenses]
  );

  /** Average monthly revenue over the trailing quarter, from the same series the Overview uses. */
  const avgMonthlyRevenue = useMemo(() => {
    const recent = (dashboardData.revenueData ?? []).slice(-3);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, m) => sum + (m.total ?? 0), 0) / recent.length;
  }, [dashboardData.revenueData]);

  const burnShare = avgMonthlyRevenue > 0 ? fixedMonthlyBurn / avgMonthlyRevenue : 0;

  // ── Renewal radar ─────────────────────────────────────────────────────────
  const upcoming = useMemo(() => {
    return expenses
      .filter((e) => e.recurrence !== 'none')
      .map((e) => ({ expense: e, due: nextChargeDate(e) }))
      .filter((row): row is { expense: Expense; due: Date } => row.due !== null)
      .map((row) => ({ ...row, inDays: daysUntil(row.due) }))
      .filter((row) => row.inDays <= 30)
      .sort((a, b) => a.inDays - b.inDays);
  }, [expenses]);

  // ── Filtered ledger ───────────────────────────────────────────────────────
  const bounds = periodBounds(period);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (bounds && !isWithin(toDate(e.date), bounds.start, bounds.end)) return false;
      if (!term) return true;
      const projectName = e.projectId ? projectNames.get(e.projectId) ?? '' : '';
      return `${e.vendor} ${e.description} ${EXPENSE_CATEGORY_LABELS[e.category]} ${projectName}`
        .toLowerCase()
        .includes(term);
    });
  }, [expenses, search, category, bounds?.start, bounds?.end, projectNames]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + grossAmount(e), 0),
    [filtered]
  );

  const breakdown = useMemo(() => totalsByCategory(filtered).slice(0, 6), [filtered]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end } =
    usePagination(filtered, { resetKey: `${search}|${category}|${period}` });

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (expense: Expense) => { setEditing(expense); setModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.receiptPath) {
        try { await deleteObject(ref(storage, deleteTarget.receiptPath)); } catch { /* already gone */ }
      }
      await deleteDoc(doc(db, 'expenses', deleteTarget.id));
      toast.success('Expense removed.');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to remove the expense.');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Quantum size="100" speed="1.75" color="white" />
        <p className="text-spaceText">Loading expenses…</p>
      </div>
    );
  }

  const selectClass =
    "h-9 rounded-lg border border-spaceAccent/35 bg-space1/85 px-2.5 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="virtara-display text-2xl text-spaceText">Expenses</h2>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record expense
          </Button>
        </div>
        <p className="mt-2 max-w-prose text-sm text-spaceAlt/90">
          Every rand out of the business — what it costs to keep the lights on, and what each job
          really costs to deliver.
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 px-6 py-14 text-center">
          <WalletMinimal className="mx-auto h-9 w-9 text-spaceAccent" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-spaceText">No expenses recorded yet</h3>
          <p className="mx-auto mt-2 max-w-prose text-sm text-spaceAlt/90">
            Start with the costs you pay every month — hosting, Adobe, your accountant. Once those are
            in, this page tells you your fixed monthly burn, what you can claim back at tax time, and
            what each project actually costs to deliver.
          </p>
          <Button onClick={openNew} className="mt-6">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record your first expense
          </Button>
        </div>
      ) : (
        <>
          {/* One continuous ledger bar rather than a row of look-alike cards. */}
          <dl className="grid divide-y divide-spaceAccent/15 overflow-hidden rounded-2xl border border-spaceAccent/25 bg-space2/50 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <div className="p-5 max-sm:border-b max-sm:border-spaceAccent/15 sm:border-b sm:border-spaceAccent/15 lg:border-b-0">
              <dt className="text-sm text-spaceAlt/90">Spent this month</dt>
              <dd className="mt-1.5 text-2xl font-bold tabular-nums text-spaceText">
                {formatZAR(spentThisMonth)}
              </dd>
              <p className="mt-1 text-xs text-spaceAlt/75">
                {thisMonth.start.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="p-5 sm:border-b sm:border-spaceAccent/15 lg:border-b-0">
              <dt className="text-sm text-spaceAlt/90">Fixed monthly burn</dt>
              <dd className="mt-1.5 text-2xl font-bold tabular-nums text-spaceAccent">
                {formatZAR(fixedMonthlyBurn)}
              </dd>
              <p className="mt-1 text-xs text-spaceAlt/75">
                {avgMonthlyRevenue > 0
                  ? `${Math.round(burnShare * 100)}% of an average month's revenue`
                  : 'Recurring costs, normalised per month'}
              </p>
            </div>

            <div className="p-5 max-sm:border-b max-sm:border-spaceAccent/15">
              <dt className="text-sm text-spaceAlt/90">VAT to reclaim</dt>
              <dd className="mt-1.5 text-2xl font-bold tabular-nums text-spaceText">
                {formatZAR(reclaimableVat)}
              </dd>
              <p className="mt-1 text-xs text-spaceAlt/75">Input VAT, {taxYear.label} tax year</p>
            </div>

            <div className="p-5">
              <dt className="text-sm text-spaceAlt/90">Deductible spend</dt>
              <dd className="mt-1.5 text-2xl font-bold tabular-nums text-spaceText">
                {formatZAR(deductibleTotal)}
              </dd>
              <p className="mt-1 text-xs text-spaceAlt/75">
                1 Mar – end Feb · {taxYearExpenses.length}{' '}
                {taxYearExpenses.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
          </dl>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            {/* Renewal radar */}
            <section
              aria-labelledby="renewals-heading"
              className="rounded-2xl border border-spaceAccent/25 bg-space2/50 p-5"
            >
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-spaceAccent" aria-hidden="true" />
                <h3 id="renewals-heading" className="text-sm font-semibold text-spaceText">
                  Renewing in the next 30 days
                </h3>
              </div>

              {upcoming.length === 0 ? (
                <p className="mt-4 text-sm text-spaceAlt/85">
                  Nothing recurring is due in the next month. Mark a cost as monthly or annual when you
                  record it and it will show up here before it hits your account.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {upcoming.slice(0, 6).map(({ expense, due, inDays }) => (
                    <li key={expense.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-spaceText">{expense.vendor}</p>
                        <p className="text-xs text-spaceAlt/80">
                          {inDays <= 0
                            ? 'Due today'
                            : `In ${inDays} day${inDays === 1 ? '' : 's'} · ${due.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-spaceText">
                        {formatZAR(grossAmount(expense))}
                      </span>
                    </li>
                  ))}
                  {upcoming.length > 6 && (
                    <li className="pt-1 text-xs text-spaceAlt/75">
                      +{upcoming.length - 6} more due this month
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* Category breakdown */}
            <section
              aria-labelledby="breakdown-heading"
              className="rounded-2xl border border-spaceAccent/25 bg-space2/50 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="breakdown-heading" className="text-sm font-semibold text-spaceText">
                  Where the money goes
                </h3>
                <span className="text-xs text-spaceAlt/80">
                  {PERIODS.find((p) => p.value === period)?.label}
                </span>
              </div>

              {breakdown.length === 0 ? (
                <p className="mt-4 text-sm text-spaceAlt/85">
                  No expenses in this period. Widen the filter below to see more.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {breakdown.map((row, index) => (
                    <li key={row.category}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-spaceText">
                          {EXPENSE_CATEGORY_LABELS[row.category]}
                        </span>
                        <span className="shrink-0 tabular-nums text-spaceAlt/90">
                          {formatZAR(row.total)}
                          <span className="ml-2 text-xs text-spaceAlt/70">
                            {Math.round(row.share * 100)}%
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-space1">
                        <div
                          className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                          style={{
                            width: `${Math.max(row.share * 100, 1.5)}%`,
                            backgroundColor: rampColor(index),
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Ledger */}
          <section className="overflow-hidden rounded-2xl border border-spaceAccent/25 bg-space2/50">
            <div className="flex flex-wrap items-center gap-3 border-b border-spaceAccent/20 p-4">
              <div className="relative min-w-52 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spaceAlt/80"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendor, note or project"
                  aria-label="Search expenses"
                  className="h-9 border-spaceAccent/35 bg-space1/85 pl-9 text-spaceText placeholder:text-spaceAlt/60"
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory | 'all')}
                aria-label="Filter by category"
                className={selectClass}
              >
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                aria-label="Filter by period"
                className={selectClass}
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="ml-auto text-sm text-spaceAlt/90">
                Total <span className="font-semibold tabular-nums text-spaceText">{formatZAR(filteredTotal)}</span>
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-spaceAlt/85">
                Nothing matches those filters.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-spaceAccent/20 hover:bg-transparent">
                        <TableHead className="text-spaceAlt">Date</TableHead>
                        <TableHead className="text-spaceAlt">Paid to</TableHead>
                        <TableHead className="text-spaceAlt">Category</TableHead>
                        <TableHead className="text-spaceAlt">Project</TableHead>
                        <TableHead className="text-right text-spaceAlt">Amount</TableHead>
                        <TableHead className="text-right text-spaceAlt">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((expense) => {
                        const when = toDate(expense.date);
                        const projectName = expense.projectId ? projectNames.get(expense.projectId) : null;
                        return (
                          <TableRow key={expense.id} className="border-spaceAccent/15 hover:bg-space1/50">
                            <TableCell className="whitespace-nowrap text-sm text-spaceAlt/90">
                              {when ? when.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                            </TableCell>
                            <TableCell className="max-w-56">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-spaceText">{expense.vendor}</span>
                                {expense.receiptUrl && (
                                  <a
                                    href={expense.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`View receipt for ${expense.vendor}`}
                                    className="shrink-0 text-spaceAccent transition-opacity duration-150 hover:opacity-70"
                                  >
                                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                              {expense.description && (
                                <p className="truncate text-xs text-spaceAlt/75">{expense.description}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-spaceAlt/90">
                              <span className="block">{EXPENSE_CATEGORY_LABELS[expense.category]}</span>
                              {expense.recurrence !== 'none' && (
                                <Badge variant="secondary" className="mt-1 text-[10px] font-medium">
                                  {RECURRENCE_LABELS[expense.recurrence]}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-sm text-spaceAlt/90">
                              {projectName ?? <span className="text-spaceAlt/60">Overhead</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-spaceText">
                              {formatZAR(grossAmount(expense))}
                              {expense.billable && (
                                <span className="ml-2 text-xs font-normal text-spaceAccent">rebilled</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(expense)}
                                  aria-label={`Edit expense for ${expense.vendor}`}
                                  className="rounded-md p-1.5 text-spaceAlt/70 transition-colors duration-150 hover:bg-space1 hover:text-spaceText focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(expense)}
                                  aria-label={`Delete expense for ${expense.vendor}`}
                                  className="rounded-md p-1.5 text-spaceAlt/70 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  start={start}
                  end={end}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="expenses"
                />
              </>
            )}
          </section>
        </>
      )}

      <ExpenseModal open={modalOpen} onOpenChange={setModalOpen} expense={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}
        title="Remove expense"
        description={
          <>
            Delete the {formatZAR(deleteTarget ? grossAmount(deleteTarget) : 0)} expense paid to{' '}
            <span className="text-spaceText">{deleteTarget?.vendor}</span>? Its receipt will be deleted too.
          </>
        }
        confirmLabel="Delete expense"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
