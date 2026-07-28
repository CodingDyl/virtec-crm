'use client'

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { useProjects } from '@/contexts/DataContexts';
import {
  Expense,
  ExpenseCategory,
  ExpenseRecurrence,
  PaymentMethod,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  RECURRENCE_LABELS,
} from '@/types/expense';
import { VAT_RATE, formatZARExact, grossAmount, monthlyEquivalent, vatPortion } from '@/lib/expenses';
import { toDate } from '@/lib/firestore-schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { Paperclip, X } from 'lucide-react';

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an expense to edit it; omit to capture a new one. */
  expense?: Expense | null;
  /** Pre-links a new expense to a project — used when logging a cost from the workspace. */
  defaultProjectId?: string;
}

interface FormState {
  vendor: string;
  description: string;
  category: ExpenseCategory;
  amount: string;
  vatIncluded: boolean;
  vatable: boolean;
  paymentMethod: PaymentMethod;
  recurrence: ExpenseRecurrence;
  billable: boolean;
  taxDeductible: boolean;
  projectId: string;
  date: string;
}

const toInputDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const emptyForm = (): FormState => ({
  vendor: '',
  description: '',
  category: 'software',
  amount: '',
  vatIncluded: true,
  vatable: true,
  paymentMethod: 'card',
  recurrence: 'none',
  billable: false,
  taxDeductible: true,
  projectId: '',
  date: toInputDate(new Date()),
});

const fieldClass =
  "flex h-10 w-full rounded-md border border-spaceAccent/40 bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

export function ExpenseModal({ open, onOpenChange, expense, defaultProjectId }: ExpenseModalProps) {
  const { projects } = useProjects();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(expense);

  useEffect(() => {
    if (!open) return;
    setReceipt(null);
    setRemoveExistingReceipt(false);

    if (!expense) {
      setForm({ ...emptyForm(), projectId: defaultProjectId ?? '' });
      return;
    }

    const date = toDate(expense.date);
    setForm({
      vendor: expense.vendor,
      description: expense.description,
      category: expense.category,
      amount: String(expense.amount || ''),
      vatIncluded: expense.vatIncluded,
      vatable: expense.vatRate > 0,
      paymentMethod: expense.paymentMethod,
      recurrence: expense.recurrence,
      billable: expense.billable,
      taxDeductible: expense.taxDeductible,
      projectId: expense.projectId ?? '',
      date: toInputDate(date ?? new Date()),
    });
  }, [open, expense, defaultProjectId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const preview = useMemo(() => {
    const amount = Number(form.amount) || 0;
    const shape = {
      amount,
      vatIncluded: form.vatIncluded,
      vatRate: form.vatable ? VAT_RATE : 0,
      recurrence: form.recurrence,
    };
    return {
      gross: grossAmount(shape),
      vat: vatPortion(shape),
      perMonth: monthlyEquivalent(shape),
    };
  }, [form.amount, form.vatIncluded, form.vatable, form.recurrence]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.vendor.trim()) {
      toast.error('Add who you paid.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      let receiptUrl = expense?.receiptUrl ?? null;
      let receiptPath = expense?.receiptPath ?? null;

      if ((receipt || removeExistingReceipt) && expense?.receiptPath) {
        try { await deleteObject(ref(storage, expense.receiptPath)); } catch { /* already gone */ }
        receiptUrl = null;
        receiptPath = null;
      }

      if (receipt) {
        const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        receiptPath = `receipts/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, receiptPath);
        await uploadBytes(storageRef, receipt);
        receiptUrl = await getDownloadURL(storageRef);
      }

      const linkedProject = projects.find((p) => p.id === form.projectId);
      const payload = {
        vendor: form.vendor.trim(),
        description: form.description.trim(),
        category: form.category,
        amount,
        vatIncluded: form.vatIncluded,
        vatRate: form.vatable ? VAT_RATE : 0,
        paymentMethod: form.paymentMethod,
        recurrence: form.recurrence,
        billable: form.billable,
        taxDeductible: form.taxDeductible,
        projectId: form.projectId || null,
        clientId: linkedProject?.clientId ?? null,
        receiptUrl,
        receiptPath,
        date: Timestamp.fromDate(new Date(`${form.date}T12:00:00`)),
        updatedAt: serverTimestamp(),
      };

      if (expense) {
        await updateDoc(doc(db, 'expenses', expense.id), payload);
        toast.success('Expense updated.');
      } else {
        await addDoc(collection(db, 'expenses'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Expense recorded.');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Failed to save the expense.');
    } finally {
      setSaving(false);
    }
  };

  const existingReceipt = expense?.receiptUrl && !removeExistingReceipt && !receipt;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-space2 border-spaceAccent/40 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-spaceText">
            {isEdit ? 'Edit expense' : 'Record an expense'}
          </DialogTitle>
          <DialogDescription className="text-spaceAlt/90">
            Tag it to a project and it counts against that job&apos;s margin. Mark it recurring and it
            joins your fixed monthly burn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vendor" className="text-spaceText">Paid to</Label>
              <Input
                id="vendor"
                value={form.vendor}
                onChange={(e) => set('vendor', e.target.value)}
                placeholder="Adobe, Takealot, Telkom…"
                className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
              />
            </div>
            <div>
              <Label htmlFor="expense-date" className="text-spaceText">Date paid</Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="expense-category" className="text-spaceText">Category</Label>
            <select
              id="expense-category"
              value={form.category}
              onChange={(e) => set('category', e.target.value as ExpenseCategory)}
              className={`mt-1.5 ${fieldClass}`}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-spaceAlt/80">
              {EXPENSE_CATEGORIES.find((c) => c.value === form.category)?.hint}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-amount" className="text-spaceText">Amount (R)</Label>
              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
              />
            </div>
            <div>
              <Label htmlFor="expense-recurrence" className="text-spaceText">Repeats</Label>
              <select
                id="expense-recurrence"
                value={form.recurrence}
                onChange={(e) => set('recurrence', e.target.value as ExpenseRecurrence)}
                className={`mt-1.5 ${fieldClass}`}
              >
                {(Object.keys(RECURRENCE_LABELS) as ExpenseRecurrence[]).map((r) => (
                  <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-method" className="text-spaceText">Paid by</Label>
              <select
                id="expense-method"
                value={form.paymentMethod}
                onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
                className={`mt-1.5 ${fieldClass}`}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="expense-project" className="text-spaceText">Project (optional)</Label>
              <select
                id="expense-project"
                value={form.projectId}
                onChange={(e) => set('projectId', e.target.value)}
                className={`mt-1.5 ${fieldClass}`}
              >
                <option value="">Business overhead — no project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectType}{p.clientName ? ` — ${p.clientName}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="expense-note" className="text-spaceText">Note (optional)</Label>
            <Input
              id="expense-note"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What was it for?"
              className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
            />
          </div>

          <fieldset className="rounded-xl border border-spaceAccent/20 bg-space1/50 p-4">
            <legend className="px-1.5 text-sm font-medium text-spaceText">VAT &amp; tax</legend>
            <div className="mt-1 space-y-3">
              <label className="flex items-start gap-2.5 text-sm text-spaceAlt/95">
                <Checkbox
                  checked={form.vatable}
                  onCheckedChange={(checked) => set('vatable', checked === true)}
                  aria-label="Supplier charges VAT"
                />
                <span>Supplier charges VAT ({Math.round(VAT_RATE * 100)}%)</span>
              </label>
              {form.vatable && (
                <label className="flex items-start gap-2.5 text-sm text-spaceAlt/95">
                  <Checkbox
                    checked={form.vatIncluded}
                    onCheckedChange={(checked) => set('vatIncluded', checked === true)}
                    aria-label="Amount above already includes VAT"
                  />
                  <span>The amount above already includes VAT</span>
                </label>
              )}
              <label className="flex items-start gap-2.5 text-sm text-spaceAlt/95">
                <Checkbox
                  checked={form.taxDeductible}
                  onCheckedChange={(checked) => set('taxDeductible', checked === true)}
                  aria-label="Tax deductible business expense"
                />
                <span>Deductible business expense</span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-spaceAlt/95">
                <Checkbox
                  checked={form.billable}
                  onCheckedChange={(checked) => set('billable', checked === true)}
                  aria-label="Rechargeable to the client"
                />
                <span>Recharged to the client</span>
              </label>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="expense-receipt" className="text-spaceText">Receipt (optional)</Label>
            {existingReceipt ? (
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-spaceAccent/30 bg-space1 px-3 py-2">
                <a
                  href={expense!.receiptUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 text-sm text-spaceAccent hover:underline"
                >
                  <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">View attached receipt</span>
                </a>
                <button
                  type="button"
                  onClick={() => setRemoveExistingReceipt(true)}
                  aria-label="Remove attached receipt"
                  className="rounded-md p-1 text-spaceAlt/70 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Input
                id="expense-receipt"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText file:mr-3 file:text-spaceText"
              />
            )}
          </div>

          {Number(form.amount) > 0 && (
            <dl
              className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-xl border border-spaceAccent/20 bg-space1/50 px-4 py-3 text-sm"
              aria-live="polite"
            >
              <div className="flex gap-2">
                <dt className="text-spaceAlt/80">Total out</dt>
                <dd className="font-semibold tabular-nums text-spaceText">{formatZARExact(preview.gross)}</dd>
              </div>
              {preview.vat > 0 && (
                <div className="flex gap-2">
                  <dt className="text-spaceAlt/80">VAT portion</dt>
                  <dd className="font-semibold tabular-nums text-spaceText">{formatZARExact(preview.vat)}</dd>
                </div>
              )}
              {preview.perMonth > 0 && (
                <div className="flex gap-2">
                  <dt className="text-spaceAlt/80">Adds to monthly burn</dt>
                  <dd className="font-semibold tabular-nums text-spaceAccent">{formatZARExact(preview.perMonth)}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="sm:min-w-40">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Record expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
