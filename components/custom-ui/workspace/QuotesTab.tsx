'use client'

import { useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { useQuotes } from '@/contexts/DataContexts';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadDocumentModal } from "../upload-document-modal";
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { logActivity } from '@/lib/activity';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

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

  const projectQuotes = useMemo(
    () => quotes.filter((q) => ((q as any).projectId ?? (q as any).project_id) === project.id),
    [quotes, project.id]
  );

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

      {projectQuotes.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No quotes for this project yet. Use “Upload Document” → Quote to add one.
        </p>
      ) : (
        <ul className="space-y-2">
          {projectQuotes.map((quote) => {
            const amount = pickNumber(quote as any, ['totalAmount', 'total_amount'], 0);
            const created = toDate((quote as any).createdAt ?? quote.created_at);
            const pdf = (quote as any).pdfUrl ?? quote.pdf_url;
            return (
              <li key={quote.id} className="rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-spaceText">R{amount.toLocaleString()}</p>
                    <p className="text-xs text-spaceAlt/70">{created ? format(created, 'dd MMM yyyy') : '—'}</p>
                  </div>
                  <Badge className={`text-white capitalize ${statusBadge(quote.status)}`}>{quote.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {pdf && (
                    <Button size="sm" variant="outline" className="border-spaceAccent/40 bg-space2 text-spaceText"
                      onClick={() => window.open(pdf, '_blank')}>
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
