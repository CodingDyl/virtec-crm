'use client'

import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { MaintenanceFrequency, MaintenanceInvoice } from '@/types/maintenance';
import { useMaintenanceInvoices } from '@/contexts/DataContexts';
import { logActivity } from '@/lib/activity';
import { toDate } from '@/lib/firestore-schema';
import {
  DEFAULT_MAINTENANCE_FREQUENCY,
  MAINTENANCE_FREQUENCIES,
  cyclesPerYear,
  formatRand,
  frequencyLabel,
  invoiceLabel,
  nextDueDate,
  summariseMaintenance,
} from '@/lib/maintenance';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText, Link2, CalendarClock } from 'lucide-react';

interface MaintenanceTabProps {
  project: Project;
}

function statusTone(status: MaintenanceInvoice['status']) {
  switch (status) {
    case 'paid': return 'bg-green-500';
    case 'emailed': return 'bg-blue-500';
    case 'overdue': return 'bg-red-500';
    default: return 'bg-yellow-500';
  }
}

export function MaintenanceTab({ project }: MaintenanceTabProps) {
  const { invoices, isLoading } = useMaintenanceInvoices();

  const [frequency, setFrequency] = useState<MaintenanceFrequency>(
    project.maintenanceFrequency ?? DEFAULT_MAINTENANCE_FREQUENCY
  );
  const [amount, setAmount] = useState<number>(project.maintenanceAmount ?? 0);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Re-seed when a different maintenance project is selected.
  useEffect(() => {
    setFrequency(project.maintenanceFrequency ?? DEFAULT_MAINTENANCE_FREQUENCY);
    setAmount(project.maintenanceAmount ?? 0);
  }, [project.id]);

  /** Invoices billed against this project — the one-to-many side of the link. */
  const projectInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.projectId === project.id),
    [invoices, project.id]
  );

  /**
   * Invoices raised for this customer before maintenance projects existed. They
   * carry a clientId but no projectId, so they belong nowhere until attached.
   */
  const unlinkedInvoices = useMemo(() => {
    if (!project.clientId) return [];
    return invoices.filter((invoice) => !invoice.projectId && invoice.clientId === project.clientId);
  }, [invoices, project.clientId]);

  const summary = useMemo(() => summariseMaintenance(projectInvoices), [projectInvoices]);
  const dueDate = nextDueDate(project.maintenanceFrequency, summary.lastInvoicedAt);
  const overdue = dueDate ? dueDate.getTime() < Date.now() : false;

  const annualRun = (project.maintenanceAmount ?? 0) * cyclesPerYear(project.maintenanceFrequency);

  const handleSaveBilling = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        maintenanceFrequency: frequency,
        maintenanceAmount: amount,
      });
      await logActivity(
        'project',
        project.id,
        'maintenance',
        `Maintenance billing set to ${frequencyLabel(frequency)} at ${formatRand(amount)} per cycle`
      );
      toast.success('Billing cycle saved.');
    } catch (error) {
      console.error('Error saving maintenance billing:', error);
      toast.error('Failed to save the billing cycle.');
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async (invoice: MaintenanceInvoice) => {
    setLinkingId(invoice.id);
    try {
      await updateDoc(doc(db, 'maintenance_invoices', invoice.id), { projectId: project.id });
      await logActivity(
        'project',
        project.id,
        'maintenance',
        `Invoice ${invoiceLabel(invoice)} attached to this maintenance project`
      );
      toast.success(`${invoiceLabel(invoice)} attached.`);
    } catch (error) {
      console.error('Error linking invoice:', error);
      toast.error('Failed to attach the invoice.');
    } finally {
      setLinkingId(null);
    }
  };

  const handleMarkPaid = async (invoice: MaintenanceInvoice) => {
    setUpdatingId(invoice.id);
    try {
      await updateDoc(doc(db, 'maintenance_invoices', invoice.id), { status: 'paid' });
      await logActivity(
        'project',
        project.id,
        'maintenance',
        `Invoice ${invoiceLabel(invoice)} marked paid — ${formatRand(invoice.totalAmount)}`
      );
      toast.success(`${invoiceLabel(invoice)} marked paid.`);
    } catch (error) {
      console.error('Error marking invoice paid:', error);
      toast.error('Failed to update the invoice.');
    } finally {
      setUpdatingId(null);
    }
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  // The workspace pane is narrow and resizes independently of the viewport, so
  // this panel lays itself out against its own width rather than the screen's.
  return (
    <div className="@container space-y-4">
      {/* Billing position */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-spaceAccent/25 bg-spaceAccent/15 @md:grid-cols-4">
        <div className="min-w-0 bg-space1/90 p-3">
          <p className="truncate text-[10px] uppercase tracking-wide text-spaceAlt/70">Total paid</p>
          <p className="mt-1 text-lg font-bold tabular-nums break-words text-spaceAccent">{formatRand(summary.totalPaid)}</p>
        </div>
        <div className="min-w-0 bg-space1/90 p-3">
          <p className="truncate text-[10px] uppercase tracking-wide text-spaceAlt/70">Outstanding</p>
          <p className={`mt-1 text-lg font-bold tabular-nums break-words ${summary.outstanding > 0 ? 'text-yellow-300' : 'text-spaceText'}`}>
            {formatRand(summary.outstanding)}
          </p>
        </div>
        <div className="min-w-0 bg-space1/90 p-3">
          <p className="truncate text-[10px] uppercase tracking-wide text-spaceAlt/70">Invoices</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-spaceText">
            {summary.paidCount}<span className="text-sm text-spaceAlt/60">/{summary.invoiceCount}</span>
          </p>
        </div>
        <div className="min-w-0 bg-space1/90 p-3">
          <p className="truncate text-[10px] uppercase tracking-wide text-spaceAlt/70">Last payment</p>
          <p className="mt-1 text-sm font-semibold text-spaceText">
            {summary.lastPaidAt ? format(summary.lastPaidAt, 'dd MMM yyyy') : '—'}
          </p>
        </div>
      </div>

      {/* Cycle position */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-spaceAccent/25 bg-space1/40 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm text-spaceAlt/90">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Billed <span className="text-spaceText">{frequencyLabel(project.maintenanceFrequency).toLowerCase()}</span>
            {(project.maintenanceAmount ?? 0) > 0 && (
              <> at <span className="text-spaceText">{formatRand(project.maintenanceAmount ?? 0)}</span> a cycle</>
            )}
          </span>
        </p>
        {dueDate ? (
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${
            overdue
              ? 'border-red-500/40 bg-red-500/15 text-red-300'
              : 'border-spaceAccent/30 bg-space2/70 text-spaceAlt/90'
          }`}>
            {overdue ? 'Invoice overdue since' : 'Next invoice'} {format(dueDate, 'dd MMM yyyy')}
          </span>
        ) : (
          <span className="rounded-full border border-spaceAccent/25 bg-space2/70 px-2.5 py-0.5 text-xs text-spaceAlt/70">
            No schedule yet
          </span>
        )}
      </div>

      {/* Billing settings */}
      <div className="space-y-3 rounded-xl border border-spaceAccent/20 bg-space1/40 p-3">
        <p className="text-sm font-semibold text-spaceText">Billing cycle</p>
        <div className="grid gap-3 @md:grid-cols-2">
          <div>
            <label htmlFor="maintenance-frequency" className="text-sm text-spaceText">Payment frequency</label>
            <select
              id="maintenance-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as MaintenanceFrequency)}
              className={`mt-1 ${selectClass}`}
            >
              {MAINTENANCE_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="maintenance-amount" className="text-sm text-spaceText">Amount per cycle (R)</label>
            <Input
              id="maintenance-amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, '')) : 0)}
              className="mt-1 bg-space1 border-spaceAccent text-spaceText"
            />
          </div>
        </div>
        {annualRun > 0 && (
          <p className="text-xs text-spaceAlt/70">
            Run rate: <span className="text-spaceAccent">{formatRand(annualRun)}</span> a year
          </p>
        )}
        <Button
          onClick={handleSaveBilling}
          disabled={saving}
          className="w-full bg-spaceAccent hover:bg-spaceAlt text-space1 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save billing cycle'}
        </Button>
      </div>

      {/* Unlinked history */}
      {unlinkedInvoices.length > 0 && (
        <div className="space-y-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
          <p className="text-sm font-medium text-yellow-200">
            {unlinkedInvoices.length} invoice{unlinkedInvoices.length > 1 ? 's' : ''} for this customer
            {unlinkedInvoices.length > 1 ? ' are' : ' is'} not attached to any project.
          </p>
          <p className="text-xs text-yellow-200/80">
            Attach them here to count toward this project&apos;s totals.
          </p>
          <ul className="space-y-1.5 pt-1">
            {unlinkedInvoices.map((invoice) => {
              const issued = toDate(invoice.date);
              return (
                <li key={invoice.id} className="flex items-center justify-between gap-2 rounded-lg bg-space1/60 px-2.5 py-2">
                  <span className="min-w-0 text-xs text-spaceAlt/90">
                    <span className="text-spaceText">{invoiceLabel(invoice)}</span>
                    {' · '}{formatRand(invoice.totalAmount)}
                    {issued && <>{' · '}{format(issued, 'dd MMM yyyy')}</>}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={linkingId === invoice.id}
                    onClick={() => handleLink(invoice)}
                    className="shrink-0 border-spaceAccent/40 bg-space2 text-spaceText hover:bg-space1"
                  >
                    <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {linkingId === invoice.id ? 'Attaching…' : 'Attach'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Invoice history */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-spaceText">
          Invoices <span className="text-spaceAlt/60">({projectInvoices.length})</span>
        </p>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">Loading invoices…</p>
        ) : projectInvoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">
            No invoices billed against this project yet. Generate one from the Maintenance Invoice screen.
          </p>
        ) : (
          <ul className="space-y-2">
            {projectInvoices.map((invoice) => {
              const issued = toDate(invoice.date);
              const hours = invoice.items.reduce((sum, item) => sum + (item.hours || 0), 0);
              return (
                <li key={invoice.id} className="rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-spaceText">{invoiceLabel(invoice)}</p>
                      <p className="text-xs text-spaceAlt/70">
                        {issued ? format(issued, 'dd MMM yyyy') : '—'}
                        {hours > 0 && <> · {hours} hr{hours === 1 ? '' : 's'}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-spaceText">
                        {formatRand(invoice.totalAmount)}
                      </span>
                      <Badge className={`text-white capitalize ${statusTone(invoice.status)}`}>{invoice.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {invoice.pdfUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-spaceAccent/40 bg-space2 text-spaceText"
                        onClick={() => window.open(invoice.pdfUrl, '_blank')}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> PDF
                      </Button>
                    )}
                    {invoice.status !== 'paid' && (
                      <Button
                        size="sm"
                        disabled={updatingId === invoice.id}
                        onClick={() => handleMarkPaid(invoice)}
                        className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {updatingId === invoice.id ? 'Updating…' : 'Mark as paid'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
