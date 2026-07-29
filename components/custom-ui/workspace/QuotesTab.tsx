'use client'

import { useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { openStoredFile } from '@/lib/storage-client';
import { quoteFileRef } from '@/lib/firestore-schema';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { useQuotes } from '@/contexts/DataContexts';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadDocumentModal } from "../upload-document-modal";
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { isMaintenanceProject } from '@/lib/maintenance';
import { logActivity } from '@/lib/activity';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText, Info } from 'lucide-react';

interface QuotesTabProps {
  project: Project;
}

function statusBadge(status: string) {
  switch (status) {
    case 'accepted': return 'bg-green-500';
    case 'rejected': return 'bg-red-500';
    default: return 'bg-yellow-500';
  }
}

export function QuotesTab({ project }: QuotesTabProps) {
  const { quotes } = useQuotes();

  const isMaintenance = isMaintenanceProject(project);

  const projectQuotes = useMemo(() => {
    const rows = quotes.filter((q) => ((q as any).projectId ?? (q as any).project_id) === project.id);
    rows.sort(
      (a, b) =>
        (toDate((b as any).createdAt ?? b.created_at)?.getTime() ?? 0) -
        (toDate((a as any).createdAt ?? a.created_at)?.getTime() ?? 0)
    );
    return rows;
  }, [quotes, project.id]);

  /**
   * A project covers one scope and so normally carries one quote — the accepted
   * one drives its value. Extra quotes are nearly always revisions, so they are
   * flagged rather than blocked. Maintenance projects are the deliberate
   * exception: they bill on a cycle, tracked in the Maintenance tab.
   */
  const primaryQuoteId =
    projectQuotes.find((q) => q.status === 'accepted')?.id ?? projectQuotes[0]?.id;
  const showRevisionNotice = !isMaintenance && projectQuotes.length > 1;

  const updateStatus = async (quote: Quote, status: 'pending' | 'accepted' | 'rejected') => {
    const amount = pickNumber(quote as any, ['totalAmount', 'total_amount'], 0);
    try {
      await updateDoc(doc(db, 'quotes', quote.id), { status });
      await logActivity('project', project.id, 'quote', `Quote marked ${status}`);
      // Accepting a quote makes it the source of truth for the project amount.
      if (status === 'accepted') {
        await updateDoc(doc(db, 'projects', project.id), { amount, quoteId: quote.id });
        await logActivity('project', project.id, 'quote', `Project amount synced to R${amount.toLocaleString()} from accepted quote`);
      }
      toast.success(`Quote ${status}.`);
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Failed to update quote.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-spaceText">Quotes</p>
        <UploadDocumentModal project={project} />
      </div>

      {isMaintenance && (
        <p className="flex items-start gap-2 rounded-lg border border-spaceAccent/25 bg-space1/50 p-2.5 text-xs text-spaceAlt/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This is a maintenance project — recurring billing lives in the{' '}
            <span className="text-spaceText">Maintenance</span> tab, one invoice per cycle.
          </span>
        </p>
      )}

      {showRevisionNotice && (
        <p className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-xs text-yellow-200/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {projectQuotes.length} quotes on one project. A project normally carries a single quote —
            the accepted one sets its value, and the rest read as superseded revisions.
          </span>
        </p>
      )}

      {projectQuotes.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No quotes for this project yet. Use “Upload Document” → Quote to add one.
        </p>
      ) : (
        <ul className="space-y-2">
          {projectQuotes.map((quote) => {
            const amount = pickNumber(quote as any, ['totalAmount', 'total_amount'], 0);
            const created = toDate((quote as any).createdAt ?? quote.created_at);
            const pdf = quoteFileRef(quote as any);
            return (
              <li key={quote.id} className="rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-spaceText">R{amount.toLocaleString()}</p>
                    <p className="text-xs text-spaceAlt/70">{created ? format(created, 'dd MMM yyyy') : '—'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {showRevisionNotice && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        quote.id === primaryQuoteId
                          ? 'border-spaceAccent/50 text-spaceAccent'
                          : 'border-spaceAlt/25 text-spaceAlt/60'
                      }`}>
                        {quote.id === primaryQuoteId ? 'Primary' : 'Superseded'}
                      </span>
                    )}
                    <Badge className={`text-white capitalize ${statusBadge(quote.status)}`}>{quote.status}</Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {pdf && (
                    <Button size="sm" variant="outline" className="border-spaceAccent/40 bg-space2 text-spaceText"
                      onClick={() => openStoredFile(pdf).catch(() => toast.error('Could not open the quote.'))}>
                      <FileText className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>
                  )}
                  {quote.status !== 'accepted' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateStatus(quote, 'accepted')}>
                      Accept
                    </Button>
                  )}
                  {quote.status !== 'pending' && (
                    <Button size="sm" variant="outline" className="border-spaceAccent/40 bg-space2 text-spaceText"
                      onClick={() => updateStatus(quote, 'pending')}>
                      Mark pending
                    </Button>
                  )}
                  {quote.status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="border-red-500/40 bg-space2 text-red-300"
                      onClick={() => updateStatus(quote, 'rejected')}>
                      Reject
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
