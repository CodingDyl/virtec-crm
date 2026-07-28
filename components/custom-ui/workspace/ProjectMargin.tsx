'use client'

import { useMemo, useState } from 'react';
import { Project } from '@/types/project';
import { useExpenses } from '@/contexts/DataContexts';
import { formatZAR, grossAmount } from '@/lib/expenses';
import { ExpenseModal } from '../expense-modal';
import { Plus } from 'lucide-react';

interface ProjectMarginProps {
  project: Project;
}

/**
 * What this job is worth against what it has cost to deliver. Only expenses
 * tagged to the project count — overheads belong to the business, not the job.
 */
export function ProjectMargin({ project }: ProjectMarginProps) {
  const { expenses } = useExpenses();
  const [logging, setLogging] = useState(false);

  const { costs, absorbed, rebilled } = useMemo(() => {
    const linked = expenses.filter((e) => e.projectId === project.id);
    return {
      costs: linked.reduce((sum, e) => sum + grossAmount(e), 0),
      // Rebilled costs are recovered from the client, so they don't erode margin.
      absorbed: linked.filter((e) => !e.billable).reduce((sum, e) => sum + grossAmount(e), 0),
      rebilled: linked.filter((e) => e.billable).length,
    };
  }, [expenses, project.id]);

  const value = project.amount ?? 0;
  const margin = value - absorbed;
  const marginPct = value > 0 ? (margin / value) * 100 : null;

  // Health reads off margin: comfortable, thin, or underwater.
  const marginTone =
    marginPct === null ? 'text-spaceText'
      : marginPct < 0 ? 'text-red-400'
      : marginPct < 25 ? 'text-yellow-400'
      : 'text-green-400';

  return (
    <section
      aria-labelledby="margin-heading"
      className="rounded-lg border border-spaceAccent/20 bg-space1/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="margin-heading" className="text-sm font-semibold text-spaceText">Job margin</h3>
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-spaceAccent transition-colors duration-150 hover:bg-spaceAccent/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Log a cost
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-space2/70 py-2">
          <dd className="text-base font-bold tabular-nums text-spaceText">{formatZAR(value)}</dd>
          <dt className="mt-0.5 text-[11px] text-spaceAlt/80">Project value</dt>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <dd className="text-base font-bold tabular-nums text-spaceText">{formatZAR(costs)}</dd>
          <dt className="mt-0.5 text-[11px] text-spaceAlt/80">Costs logged</dt>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <dd className={`text-base font-bold tabular-nums ${marginTone}`}>{formatZAR(margin)}</dd>
          <dt className="mt-0.5 text-[11px] text-spaceAlt/80">
            Margin{marginPct !== null && ` · ${Math.round(marginPct)}%`}
          </dt>
        </div>
      </dl>

      {value === 0 ? (
        <p className="mt-2 text-xs text-spaceAlt/75">
          Set an amount above (or accept a quote) to see this job&apos;s margin.
        </p>
      ) : rebilled > 0 ? (
        <p className="mt-2 text-xs text-spaceAlt/75">
          {rebilled} cost{rebilled === 1 ? '' : 's'} marked as recharged to the client, so{' '}
          {formatZAR(costs - absorbed)} isn&apos;t counted against margin.
        </p>
      ) : null}

      <ExpenseModal open={logging} onOpenChange={setLogging} defaultProjectId={project.id} />
    </section>
  );
}
