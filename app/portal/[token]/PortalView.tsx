'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import icon from '@/app/icon.png';
import { PortalData, PortalQuote } from '@/lib/portal';
import { formatZAR } from '@/lib/expenses';
import { toast } from 'sonner';
import { Check, Download, FileText, CircleCheck, Circle } from 'lucide-react';

interface PortalViewProps {
  data: PortalData;
  token: string;
}

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  active: { label: 'In progress', className: 'bg-spaceAccent/15 text-spaceAccent' },
  completed: { label: 'Complete', className: 'bg-green-500/15 text-green-300' },
  'on-hold': { label: 'On hold', className: 'bg-yellow-500/15 text-yellow-300' },
};

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PortalView({ data, token }: PortalViewProps) {
  const router = useRouter();
  const [deciding, setDeciding] = useState<string | null>(null);

  const pendingQuotes = data.quotes.filter((q) => q.status === 'pending');
  const settledQuotes = data.quotes.filter((q) => q.status !== 'pending');
  const doneCount = data.tasks.filter((t) => t.done).length;
  const status = STATUS_COPY[data.status] ?? STATUS_COPY.active;

  const decide = async (quote: PortalQuote, decision: 'accepted' | 'rejected') => {
    setDeciding(quote.id);
    try {
      const response = await fetch('/api/portal/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, quoteId: quote.id, decision }),
      });

      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: null }));
        toast.error(error ?? 'Something went wrong. Please try again.');
        return;
      }

      toast.success(
        decision === 'accepted'
          ? 'Quote accepted — thank you. We’ll be in touch.'
          : 'Quote declined. We’ll follow up with you.'
      );
      router.refresh();
    } catch (error) {
      console.error('Quote decision failed:', error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setDeciding(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="flex items-center gap-3">
        <Image src={icon} alt="" width={32} height={32} aria-hidden="true" />
        <span className="virtara-display text-lg font-bold text-spaceText">Virtara</span>
      </header>

      <div className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="virtara-display text-3xl font-bold text-spaceText sm:text-4xl">
            {data.projectType}
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
        {data.clientName && (
          <p className="mt-2 text-spaceAlt">
            Prepared for {data.clientName}
            {data.startedAt && ` · started ${formatDate(data.startedAt)}`}
          </p>
        )}
      </div>

      {/* Progress */}
      <section aria-labelledby="progress-heading" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="progress-heading" className="text-sm font-semibold text-spaceText">
            Progress
          </h2>
          {data.tasks.length > 0 && (
            <p className="text-sm text-spaceAlt">
              {doneCount} of {data.tasks.length} steps complete
            </p>
          )}
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-space2"
          role="progressbar"
          aria-valuenow={data.completion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Project completion"
        >
          <div
            className="h-full rounded-full bg-spaceAccent transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.max(Math.min(data.completion, 100), 0)}%` }}
          />
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums text-spaceText">{data.completion}%</p>
      </section>

      {/* Quotes awaiting a decision — the one thing this page asks of the reader. */}
      {pendingQuotes.length > 0 && (
        <section
          aria-labelledby="approve-heading"
          className="mt-12 rounded-2xl border border-spaceAccent/40 bg-space2/60 p-6"
        >
          <h2 id="approve-heading" className="text-lg font-semibold text-spaceText">
            {pendingQuotes.length === 1 ? 'A quote needs your approval' : 'Quotes need your approval'}
          </h2>
          <p className="mt-1.5 text-sm text-spaceAlt">
            Review the detail below and approve here — no email needed.
          </p>

          <ul className="mt-6 space-y-6">
            {pendingQuotes.map((quote) => (
              <li key={quote.id} className="border-t border-spaceAccent/20 pt-6 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-2xl font-bold tabular-nums text-spaceText">
                    {formatZAR(quote.totalAmount)}
                  </p>
                  <p className="text-sm text-spaceAlt">
                    {quote.reference}
                    {quote.createdAt && ` · ${formatDate(quote.createdAt)}`}
                  </p>
                </div>

                {quote.features.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {quote.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-spaceAlt">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-spaceAccent" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => decide(quote, 'accepted')}
                    disabled={deciding !== null}
                    className="h-11 rounded-full bg-spaceAccent px-6 text-sm font-semibold text-space1 transition-all duration-200 hover:brightness-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                  >
                    {deciding === quote.id ? 'Sending…' : 'Approve this quote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(quote, 'rejected')}
                    disabled={deciding !== null}
                    className="h-11 rounded-full border border-spaceAccent/35 px-6 text-sm font-semibold text-spaceText transition-colors duration-200 hover:bg-space1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent disabled:opacity-50"
                  >
                    Decline
                  </button>
                  {quote.pdfUrl && (
                    <a
                      href={quote.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex h-11 items-center gap-1.5 text-sm font-medium text-spaceAccent hover:underline"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Open the PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Steps */}
      {data.tasks.length > 0 && (
        <section aria-labelledby="steps-heading" className="mt-12">
          <h2 id="steps-heading" className="text-sm font-semibold text-spaceText">
            What&rsquo;s done, what&rsquo;s next
          </h2>
          <ul className="mt-4 space-y-0.5">
            {data.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 border-b border-spaceAccent/10 py-3 last:border-0">
                {task.done ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-spaceAlt/50" aria-hidden="true" />
                )}
                <span className={task.done ? 'text-spaceAlt' : 'text-spaceText'}>{task.title}</span>
                <span className="sr-only">{task.done ? '(complete)' : '(not started)'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Documents */}
      {data.documents.length > 0 && (
        <section aria-labelledby="docs-heading" className="mt-12">
          <h2 id="docs-heading" className="text-sm font-semibold text-spaceText">Your documents</h2>
          <ul className="mt-4 space-y-2">
            {data.documents.map((document) => (
              <li key={document.id}>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 rounded-xl border border-spaceAccent/20 px-4 py-3 transition-colors duration-150 hover:border-spaceAccent/45 hover:bg-space2/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-spaceText">
                      {document.name}
                    </span>
                    {document.uploadedAt && (
                      <span className="block text-xs text-spaceAlt/80">
                        Added {formatDate(document.uploadedAt)}
                      </span>
                    )}
                  </span>
                  <Download className="h-4 w-4 shrink-0 text-spaceAccent" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Settled quotes, for the record */}
      {settledQuotes.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-12">
          <h2 id="history-heading" className="text-sm font-semibold text-spaceText">Quote history</h2>
          <ul className="mt-4 space-y-2">
            {settledQuotes.map((quote) => (
              <li
                key={quote.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-spaceAccent/10 py-3 last:border-0"
              >
                <span className="text-sm text-spaceAlt">
                  {quote.reference}
                  {quote.createdAt && ` · ${formatDate(quote.createdAt)}`}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-semibold tabular-nums text-spaceText">
                    {formatZAR(quote.totalAmount)}
                  </span>
                  <span
                    className={`text-sm ${quote.status === 'accepted' ? 'text-green-400' : 'text-spaceAlt/70'}`}
                  >
                    {quote.status === 'accepted' ? 'Accepted' : 'Declined'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.tasks.length === 0 && data.documents.length === 0 && data.quotes.length === 0 && (
        <p className="mt-12 text-spaceAlt">
          We&rsquo;re getting started. This page updates on its own as work progresses — keep the link
          handy and check back any time.
        </p>
      )}

      <footer className="mt-16 border-t border-spaceAccent/15 pt-6">
        <p className="text-sm text-spaceAlt/80">
          This page updates automatically as your project progresses. Reply to our last email if
          anything looks off.
        </p>
      </footer>
    </main>
  );
}
