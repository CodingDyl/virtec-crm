'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLocalLeads } from '@/contexts/DataContexts';
import type { LocalLead, LocalLeadOutreachTemplateId } from '@/types/local-lead';
import { getOutreachDue, renderOutreachTemplate } from '@/lib/local-leads/outreach';

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  const t = new Date(value as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function QualifiedDeskSection() {
  const { localLeads, isLoading, lastUpdated, updateLeadFields } = useLocalLeads();
  const [includeReviewing, setIncludeReviewing] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<LocalLeadOutreachTemplateId>('o1');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [enrichBusy, setEnrichBusy] = useState(false);

  const rows = useMemo(() => {
    const allowed = includeReviewing
      ? new Set(['qualified', 'reviewing'])
      : new Set(['qualified']);
    return localLeads
      .filter((l) => allowed.has(l.status))
      .slice()
      .sort((a, b) => {
        const da = getOutreachDue(a);
        const db = getOutreachDue(b);
        if (da.overdue !== db.overdue) return da.overdue ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [includeReviewing, localLeads]);

  const selected = useMemo(
    () => rows.find((l) => (l.id ?? l.googlePlaceId) === selectedId) ?? rows[0] ?? null,
    [rows, selectedId]
  );

  const activeTemplate: LocalLeadOutreachTemplateId =
    (selected?.selectedTemplateId as LocalLeadOutreachTemplateId | undefined) || templateId;

  const draft = useMemo(() => {
    if (!selected) return null;
    return renderOutreachTemplate(activeTemplate, selected);
  }, [selected, activeTemplate]);

  const markSent = async (lead: LocalLead, stage: LocalLeadOutreachTemplateId) => {
    if (!lead.id) return;
    setBusyId(lead.id);
    try {
      const field =
        stage === 'o1' ? 'outreach1SentAt' : stage === 'o2' ? 'outreach2SentAt' : 'outreach3SentAt';
      await updateLeadFields(lead.id, {
        [field]: new Date(),
        outreachStage: stage,
        selectedTemplateId: stage,
      });
      toast.success(`Marked ${stage.toUpperCase()} sent (draft only — no email fired).`);
    } catch (error) {
      console.error(error);
      toast.error('Could not update outreach stage.');
    } finally {
      setBusyId(null);
    }
  };

  const markReplied = async (lead: LocalLead) => {
    if (!lead.id) return;
    setBusyId(lead.id);
    try {
      await updateLeadFields(lead.id, {
        outreachStage: 'replied',
        outreachRepliedAt: new Date(),
      });
      toast.success('Marked replied.');
    } catch (error) {
      console.error(error);
      toast.error('Could not mark replied.');
    } finally {
      setBusyId(null);
    }
  };

  const markStopped = async (lead: LocalLead) => {
    if (!lead.id) return;
    setBusyId(lead.id);
    try {
      await updateLeadFields(lead.id, { outreachStage: 'stopped' });
      toast.success('Sequence stopped.');
    } catch (error) {
      console.error(error);
      toast.error('Could not stop sequence.');
    } finally {
      setBusyId(null);
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    const text = ['Subject: ' + draft.subject, '', draft.body].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Draft copied — Attach HOLD: paste manually only.');
    } catch {
      toast.error('Clipboard blocked — select and copy manually.');
    }
  };

  const requestEnrich = async (leadIds: string[]) => {
    if (!leadIds.length) return;
    setEnrichBusy(true);
    try {
      const statuses = includeReviewing
        ? (['qualified', 'reviewing'] as const)
        : (['qualified'] as const);
      const res = await fetch('/api/local-leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          limit: Math.min(100, Math.max(1, leadIds.length)),
          statuses: [...statuses],
        }),
      });
      if (res.status === 404 || res.status === 501) {
        toast.message('Enrich API not on this deploy yet — merge Backend PR #10.');
        return;
      }
      if (res.status === 401) {
        toast.error('Unauthorized — sign in again.');
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        toast.error(`Enrich failed (${res.status}): ${body.slice(0, 120)}`);
        return;
      }
      const summary = (await res.json()) as {
        enriched?: number;
        skipped?: number;
        failed?: number;
      };
      toast.success(
        `Enrich done — ${summary.enriched ?? 0} enriched, ${summary.skipped ?? 0} skipped, ${summary.failed ?? 0} failed.`
      );
    } catch (error) {
      console.error(error);
      toast.message('Enrich API not reachable — merge/deploy Backend PR #10.');
    } finally {
      setEnrichBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="virtara-display text-2xl text-spaceText">Qualified desk</h2>
          <p className="mt-1 text-sm text-spaceAlt/80">
            Qualified pipeline → owner email → O1/O2/O3 drafts. No live sends (Attach HOLD).
          </p>
          {lastUpdated ? (
            <p className="mt-1 text-xs text-spaceAlt/60">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-spaceAlt/80">
            <input
              type="checkbox"
              checked={includeReviewing}
              onChange={(e) => setIncludeReviewing(e.target.checked)}
            />
            Include reviewing
          </label>
          <button
            type="button"
            disabled={enrichBusy || !rows.length}
            onClick={() => requestEnrich(rows.map((r) => r.id).filter(Boolean) as string[])}
            className="rounded-lg border border-spaceAccent/30 bg-space1/60 px-3 py-1.5 text-xs text-spaceText disabled:opacity-50"
          >
            {enrichBusy ? 'Enriching…' : 'Enrich emails (batch)'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-spaceAlt/70">Loading leads…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-spaceAccent/20 bg-space1/40 px-4 py-6 text-sm text-spaceAlt/80">
          No qualified leads yet. Mark leads as qualified on Local leads first.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-spaceAccent/25 bg-space1/40">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-spaceText">
                <thead className="border-b border-spaceAccent/20 bg-space2/50 text-spaceAlt/80">
                  <tr>
                    <th className="px-3 py-2 font-medium">Business</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lead) => {
                    const id = lead.id ?? lead.googlePlaceId;
                    const due = getOutreachDue(lead);
                    const active = (selected?.id ?? selected?.googlePlaceId) === id;
                    return (
                      <tr
                        key={id}
                        className={`cursor-pointer border-b border-spaceAccent/10 hover:bg-spaceAccent/10 ${
                          active ? 'bg-spaceAccent/15' : ''
                        }`}
                        onClick={() => {
                          setSelectedId(id);
                          setTemplateId(lead.selectedTemplateId || due.next || 'o1');
                        }}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-spaceAlt/60">
                            {lead.category} · {lead.area || '—'} · {lead.status}
                          </div>
                        </td>
                        <td className="px-3 py-2">{lead.score}</td>
                        <td className="px-3 py-2">
                          {lead.ownerEmail ? (
                            <span>
                              {lead.ownerEmail}
                              {lead.emailConfidence ? (
                                <span className="text-spaceAlt/50"> ({lead.emailConfidence})</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-spaceAlt/50">
                              {lead.enrichError ? 'enrich error' : 'not enriched'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{lead.outreachStage ?? 'none'}</td>
                        <td className="px-3 py-2">
                          <span className={due.overdue ? 'text-amber-300' : 'text-spaceAlt/80'}>
                            {due.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-spaceAccent/25 bg-space1/40 p-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-spaceText">{selected.name}</h3>
                    <p className="text-xs text-spaceAlt/70">
                      {selected.phone || 'no phone'} · {selected.websiteUrl || 'no site'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={enrichBusy || !selected.id}
                    onClick={() => selected.id && requestEnrich([selected.id])}
                    className="rounded-md border border-spaceAccent/30 px-2 py-1 text-[11px] disabled:opacity-50"
                  >
                    Enrich email
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(['o1', 'o2', 'o3'] as LocalLeadOutreachTemplateId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTemplateId(id)}
                      className={`rounded-md px-2 py-1 text-[11px] ${
                        activeTemplate === id
                          ? 'bg-spaceAccent/25 text-spaceAccent'
                          : 'text-spaceAlt/70 hover:text-spaceText'
                      }`}
                    >
                      {id.toUpperCase()}
                    </button>
                  ))}
                </div>

                {draft ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-spaceAlt/70">{draft.label}</p>
                    <p className="text-xs font-medium text-spaceText">Subject: {draft.subject}</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-spaceAccent/15 bg-space2/40 p-3 text-[11px] leading-relaxed text-spaceAlt/90">
                      {draft.body}
                    </pre>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="rounded-lg bg-spaceAccent/20 px-3 py-1.5 text-xs text-spaceAccent"
                  >
                    Copy draft
                  </button>
                  <button
                    type="button"
                    disabled={!selected.id || busyId === selected.id}
                    onClick={() => markSent(selected, templateId)}
                    className="rounded-lg border border-spaceAccent/30 px-3 py-1.5 text-xs"
                  >
                    Mark {templateId.toUpperCase()} sent
                  </button>
                  <button
                    type="button"
                    disabled={!selected.id || busyId === selected.id}
                    onClick={() => markReplied(selected)}
                    className="rounded-lg border border-spaceAccent/30 px-3 py-1.5 text-xs"
                  >
                    Mark replied
                  </button>
                  <button
                    type="button"
                    disabled={!selected.id || busyId === selected.id}
                    onClick={() => markStopped(selected)}
                    className="rounded-lg border border-spaceAccent/30 px-3 py-1.5 text-xs text-spaceAlt/70"
                  >
                    Stop
                  </button>
                </div>
                <p className="text-[10px] text-spaceAlt/50">
                  O2 due 3 business days after O1 · O3 due 7 calendar days after O1 · enrichedAt{' '}
                  {toMillis(selected.enrichedAt)
                    ? new Date(toMillis(selected.enrichedAt)).toLocaleString()
                    : '—'}
                </p>
              </>
            ) : (
              <p className="text-sm text-spaceAlt/70">Select a lead.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
