'use client'

import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  HandCoins,
  LineChart,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomers, useExpenses, useFollowUps, useMaintenanceInvoices, useProducts, useProjects, useQuotes } from '@/contexts/DataContexts';
import { useDashboard } from '@/contexts/DashboardContext';
import { buildCommandCentreSummary, CommandCentreSummary } from '@/lib/business-command-centre';
import { formatZAR, monthlySpendSeries } from '@/lib/expenses';
import { effectiveDueDate, getFollowUpDisplayMeta } from '@/lib/follow-ups';
import { invoiceLabel } from '@/lib/maintenance';
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { projectsDueSilencePause, silencePausePatch, SILENCE_PAUSE_REASON } from '@/lib/delivery-ops';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { logActivity } from '@/lib/activity';
import { toast } from 'sonner';

function formatDate(date: Date | null): string {
  if (!date) return 'No date';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

function daysOld(date: Date | null): string {
  if (!date) return 'No date captured';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-spaceAccent/15 bg-space1/35 px-4 py-5 text-sm text-spaceAlt/80">
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'text-spaceAccent',
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm font-medium text-spaceText/80">{title}</CardTitle>
        <div className="rounded-lg bg-spaceAccent/10 p-2">
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <div className="break-words text-2xl font-bold tabular-nums text-spaceText">{value}</div>
        <p className="mt-2 text-xs leading-relaxed text-spaceAlt/80">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-spaceAccent/10 p-2">
            <Icon className="h-4 w-4 text-spaceAccent" />
          </div>
          <div>
            <CardTitle className="text-base text-spaceText">{title}</CardTitle>
            <CardDescription className="mt-1 text-spaceAlt/80">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
    </Card>
  );
}

function TodayQueue({ summary, silenceAlerts }: { summary: CommandCentreSummary; silenceAlerts: string[] }) {
  const derivedActions = [
    silenceAlerts.length > 0
      ? {
          title: 'Pause projects for client silence',
          detail: silenceAlerts.slice(0, 3).join(' · '),
          tone: 'bg-red-500/15 text-red-300 border-red-500/40',
        }
      : null,
    summary.cash.totalOutstanding > 0
      ? {
          title: 'Chase outstanding maintenance invoices',
          detail: `${formatZAR(summary.cash.totalOutstanding)} outstanding across ${summary.cash.topCustomers.length} customer${summary.cash.topCustomers.length === 1 ? '' : 's'}.`,
          tone: 'bg-red-500/15 text-red-300 border-red-500/40',
        }
      : null,
    summary.pipeline.stalePendingQuoteCount > 0
      ? {
          title: 'Follow up stale pending quotes',
          detail: `${summary.pipeline.stalePendingQuoteCount} pending quote${summary.pipeline.stalePendingQuoteCount === 1 ? '' : 's'} older than 3 days.`,
          tone: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/40',
        }
      : null,
    summary.projectRisks.riskCount > 0
      ? {
          title: 'Clear project delivery risks',
          detail: `${summary.projectRisks.riskCount} active project${summary.projectRisks.riskCount === 1 ? '' : 's'} need owner attention.`,
          tone: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; tone: string }>;

  return (
    <SectionCard title="Today" description="Open follow-ups and business-critical work for the next operating pass." icon={CalendarClock}>
      {summary.followUps.todayQueue.length === 0 && derivedActions.length === 0 ? (
        <PanelEmpty>No follow-ups or urgent command centre actions are due today.</PanelEmpty>
      ) : (
        <div className="space-y-3">
          {summary.followUps.todayQueue.map((followUp) => {
            const meta = getFollowUpDisplayMeta(followUp.type);
            const dueAt = effectiveDueDate(followUp);
            return (
              <div key={followUp.id} className="rounded-lg border border-spaceAccent/15 bg-space1/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-spaceText">{followUp.reason || meta.label}</p>
                    <p className="mt-1 text-sm text-spaceAlt/80">
                      {followUp.companyName || followUp.customerName}
                      {followUp.amount ? ` · ${formatZAR(followUp.amount)}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-spaceAccent/30 text-spaceAccent">
                    {formatDate(dueAt)}
                  </Badge>
                </div>
              </div>
            );
          })}
          {derivedActions.map((action) => (
            <div key={action.title} className="rounded-lg border border-spaceAccent/15 bg-space1/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-spaceText">{action.title}</p>
                  <p className="mt-1 text-sm text-spaceAlt/80">{action.detail}</p>
                </div>
                <Badge variant="outline" className={action.tone}>Action</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function CashCollectionPanel({ summary }: { summary: CommandCentreSummary }) {
  return (
    <SectionCard title="Money Owed" description="Unpaid maintenance invoices grouped by customer." icon={HandCoins}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Total outstanding</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-red-300">{formatZAR(summary.cash.totalOutstanding)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Oldest invoice</p>
          <p className="mt-1 text-sm font-semibold text-spaceText">
            {summary.cash.oldestOverdueInvoice
              ? `${invoiceLabel(summary.cash.oldestOverdueInvoice)} · ${daysOld(toDate(summary.cash.oldestOverdueInvoice.date))}`
              : 'None outstanding'}
          </p>
        </div>
      </div>
      {summary.cash.topCustomers.length === 0 ? (
        <PanelEmpty>No outstanding maintenance invoices.</PanelEmpty>
      ) : (
        <div className="space-y-2">
          {summary.cash.topCustomers.map((customer) => (
            <div key={customer.customerId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-spaceAccent/15 bg-space1/35 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-spaceText">{customer.customerName}</p>
                <p className="text-xs text-spaceAlt/75">{customer.invoiceCount} unpaid · oldest {formatDate(customer.oldestInvoiceDate)}</p>
              </div>
              <p className="font-semibold tabular-nums text-red-300">{formatZAR(customer.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PipelinePanel({ summary }: { summary: CommandCentreSummary }) {
  return (
    <SectionCard title="Pipeline" description="Quote value, conversion pressure, and stale decisions." icon={LineChart}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Pending value</p>
          <p className="mt-1 font-bold tabular-nums text-yellow-200">{formatZAR(summary.pipeline.pendingQuoteValue)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Accepted this month</p>
          <p className="mt-1 font-bold tabular-nums text-green-300">{formatZAR(summary.pipeline.acceptedQuoteValueThisMonth)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Conversion</p>
          <p className="mt-1 font-bold tabular-nums text-spaceAccent">{Math.round(summary.pipeline.conversionRate)}%</p>
        </div>
      </div>
      {summary.pipeline.topPendingQuotes.length === 0 ? (
        <PanelEmpty>No pending quotes.</PanelEmpty>
      ) : (
        <div className="space-y-2">
          {summary.pipeline.topPendingQuotes.map((quote) => (
            <div key={quote.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-spaceAccent/15 bg-space1/35 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-spaceText">{quote.projectType || 'Pending quote'}</p>
                <p className="text-xs text-spaceAlt/75">{daysOld(toDate(quote.createdAt ?? quote.created_at))}</p>
              </div>
              <p className="font-semibold tabular-nums text-spaceText">{formatZAR(pickNumber(quote, ['totalAmount', 'total_amount'], 0))}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ProjectRiskPanel({ summary }: { summary: CommandCentreSummary }) {
  return (
    <SectionCard title="Project Risks" description="Delivery, margin, agreement, and stale-work warnings." icon={ShieldAlert}>
      {summary.projectRisks.topRisks.length === 0 ? (
        <PanelEmpty>No active project risks detected.</PanelEmpty>
      ) : (
        <ScrollArea className="h-[360px] pr-3">
          <div className="space-y-3">
            {summary.projectRisks.topRisks.map((risk) => (
              <div key={risk.project.id} className="rounded-lg border border-spaceAccent/15 bg-space1/35 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-spaceText">{risk.project.projectType}</p>
                    <p className="text-sm text-spaceAlt/75">{risk.project.clientName}</p>
                  </div>
                  {risk.amountAtRisk > 0 ? (
                    <Badge variant="outline" className="border-red-500/40 text-red-300">{formatZAR(risk.amountAtRisk)}</Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {risk.reasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="border-yellow-500/35 bg-yellow-500/10 text-yellow-100">{reason}</Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-spaceAlt/80">{risk.suggestedAction}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </SectionCard>
  );
}

function MaintenancePanel({ summary }: { summary: CommandCentreSummary }) {
  return (
    <SectionCard title="Maintenance" description="Recurring maintenance revenue and upcoming billing." icon={Wrench}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Monthly recurring</p>
          <p className="mt-1 font-bold tabular-nums text-green-300">{formatZAR(summary.maintenance.monthlyRecurringRevenue)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Active customers</p>
          <p className="mt-1 font-bold tabular-nums text-spaceText">{summary.maintenance.activeMaintenanceCustomers}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Overdue invoices</p>
          <p className="mt-1 font-bold tabular-nums text-red-300">{summary.maintenance.overdueInvoiceCount}</p>
        </div>
      </div>
      {summary.maintenance.upcomingInvoices.length === 0 ? (
        <PanelEmpty>No maintenance invoices due in the next 14 days.</PanelEmpty>
      ) : (
        <div className="space-y-2">
          {summary.maintenance.upcomingInvoices.map((item) => (
            <div key={`${item.project.id}:${item.dueAt.toISOString()}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-spaceAccent/15 bg-space1/35 px-3 py-2">
              <div>
                <p className="font-medium text-spaceText">{item.project.clientName}</p>
                <p className="text-xs text-spaceAlt/75">{item.project.projectType} · due {formatDate(item.dueAt)}</p>
              </div>
              <p className="font-semibold tabular-nums text-green-300">{formatZAR(item.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ExpensePressurePanel({ summary, revenueData, expenses }: { summary: CommandCentreSummary; revenueData: any[]; expenses: any[] }) {
  const spend = monthlySpendSeries(expenses, 6);
  const series = (revenueData ?? []).map((month, index) => ({
    name: month.name,
    revenue: month.total ?? 0,
    expenses: spend[index]?.total ?? 0,
  }));
  const maxValue = Math.max(1, ...series.flatMap((item) => [item.revenue, item.expenses]));

  return (
    <SectionCard title="Expense Pressure" description="This month’s costs against current income." icon={Banknote}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">This month expenses</p>
          <p className="mt-1 font-bold tabular-nums text-red-300">{formatZAR(summary.expenses.thisMonthExpenses)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Tech debit orders</p>
          <p className="mt-1 font-bold tabular-nums text-yellow-200">{formatZAR(summary.expenses.technologyDebitOrders)}</p>
        </div>
        <div className="rounded-lg bg-space1/45 p-3">
          <p className="text-xs text-spaceAlt/80">Net month</p>
          <p className={`mt-1 font-bold tabular-nums ${summary.expenses.netMonthPosition >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {formatZAR(summary.expenses.netMonthPosition)}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {series.map((item) => (
          <div key={item.name} className="grid grid-cols-[3rem_1fr] items-center gap-3">
            <p className="text-xs text-spaceAlt/80">{item.name}</p>
            <div className="space-y-1">
              <Progress value={(item.revenue / maxValue) * 100} className="h-1.5" />
              <div className="h-1.5 rounded-full bg-red-500/20">
                <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${(item.expenses / maxValue) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {summary.expenses.largestRecurringCost ? (
        <p className="mt-4 text-xs text-spaceAlt/80">
          Largest recurring cost: {summary.expenses.largestRecurringCost.vendor || summary.expenses.largestRecurringCost.description} · {formatZAR(summary.expenses.largestRecurringCost.amount)}
        </p>
      ) : null}
    </SectionCard>
  );
}

function GrowthOpportunitiesPanel({ summary }: { summary: CommandCentreSummary }) {
  return (
    <SectionCard title="Growth Opportunities" description="Practical prompts for South African services revenue." icon={Sparkles}>
      {summary.growthOpportunities.length === 0 ? (
        <PanelEmpty>No growth prompts right now.</PanelEmpty>
      ) : (
        <div className="space-y-3">
          {summary.growthOpportunities.map((opportunity) => (
            <div key={opportunity.id} className="rounded-lg border border-spaceAccent/15 bg-space1/35 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-spaceText">{opportunity.title}</p>
                  <p className="mt-1 text-sm text-spaceAlt/80">
                    {opportunity.customerName}
                    {opportunity.projectName ? ` · ${opportunity.projectName}` : ''}
                  </p>
                </div>
                {opportunity.estimatedValue ? (
                  <Badge variant="outline" className="border-green-500/35 text-green-300">{formatZAR(opportunity.estimatedValue)}</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-spaceAlt/80">{opportunity.suggestedAction}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function CommandCentre() {
  const { dashboardData, isLoading: dashboardLoading, lastUpdated, refreshData } = useDashboard();
  const { customers, isLoading: customersLoading } = useCustomers();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { quotes, isLoading: quotesLoading } = useQuotes();
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { invoices, isLoading: invoicesLoading } = useMaintenanceInvoices();
  const { products, isLoading: productsLoading } = useProducts();
  const { followUps, isLoading: followUpsLoading } = useFollowUps();

  const isLoading = dashboardLoading || customersLoading || projectsLoading || quotesLoading || expensesLoading || invoicesLoading || productsLoading || followUpsLoading;

  const silenceEvals = useMemo(() => projectsDueSilencePause(projects), [projects]);
  const silenceAlerts = useMemo(
    () => silenceEvals.filter((item) => item.shouldPause || item.silentBusinessDays >= 5).map((item) => item.alert),
    [silenceEvals]
  );
  const appliedSilenceRef = useRef<Set<string>>(new Set());

  // Delivery Ops: auto-pause once a project hits 5 business days of client silence.
  useEffect(() => {
    const due = silenceEvals.filter((item) => item.shouldPause && !appliedSilenceRef.current.has(item.project.id));
    if (due.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of due) {
        if (cancelled) return;
        appliedSilenceRef.current.add(item.project.id);
        try {
          const patch = silencePausePatch();
          await updateDoc(doc(db, 'projects', item.project.id), {
            status: patch.status,
            pausedAt: serverTimestamp(),
            pauseReason: SILENCE_PAUSE_REASON,
          });
          await logActivity(
            'project',
            item.project.id,
            'update',
            'Auto-paused after 5 business days of client silence'
          );
          toast.message(item.alert);
        } catch (error) {
          appliedSilenceRef.current.delete(item.project.id);
          console.error('silence auto-pause failed', item.project.id, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [silenceEvals]);


  const summary = useMemo(() => {
    return buildCommandCentreSummary({
      customers,
      projects,
      quotes,
      expenses,
      invoices,
      products,
      followUps,
    });
  }, [customers, projects, quotes, expenses, invoices, products, followUps]);

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center rounded-lg border border-spaceAccent/15 bg-space2/50 p-8">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-spaceAccent" />
          <p className="mt-3 text-sm text-spaceAlt">Loading command centre data...</p>
        </div>
      </div>
    );
  }

  const lastUpdatedText = lastUpdated ? lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Not yet';
  const largestProject = summary.activeProjectValue.largestActiveProject;
  const highestFollowUp = summary.followUps.highestValueFollowUp;

  return (
    <section className="space-y-5" aria-labelledby="command-centre-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="command-centre-heading" className="virtara-display text-3xl font-bold text-spaceText">Command Centre</h2>
          <p className="mt-1 max-w-3xl text-sm text-spaceAlt/85">
            Daily operating view for cash collection, delivery risk, pipeline movement, maintenance revenue, and account growth.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refreshData} className="self-start md:self-auto">
          <RefreshCw className="h-4 w-4" />
          Updated {lastUpdatedText}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Cash to collect"
          value={formatZAR(summary.cash.totalOutstanding)}
          detail={summary.cash.oldestOverdueInvoice ? `Oldest: ${invoiceLabel(summary.cash.oldestOverdueInvoice)} (${daysOld(toDate(summary.cash.oldestOverdueInvoice.date))})` : 'No unpaid maintenance invoices'}
          icon={CircleDollarSign}
          tone="text-red-300"
        />
        <MetricCard
          title="Open follow-ups"
          value={String(summary.followUps.openCount)}
          detail={`${summary.followUps.dueTodayCount} due today · ${summary.followUps.overdueCount} overdue${highestFollowUp?.amount ? ` · top ${formatZAR(highestFollowUp.amount)}` : ''}`}
          icon={Clock3}
          tone="text-yellow-200"
        />
        <MetricCard
          title="Active project value"
          value={formatZAR(summary.activeProjectValue.totalActiveValue)}
          detail={`${summary.activeProjectValue.activeProjectCount} active · ${summary.activeProjectValue.staleActiveProjectCount} stale${largestProject ? ` · largest ${largestProject.projectType}` : ''}`}
          icon={FileText}
          tone="text-spaceAccent"
        />
        <MetricCard
          title="Monthly recurring maintenance"
          value={formatZAR(summary.maintenance.monthlyRecurringRevenue)}
          detail={`${summary.maintenance.activeMaintenanceCustomers} active customers · ${summary.maintenance.upcomingInvoices.length} upcoming invoices`}
          icon={CheckCircle2}
          tone="text-green-300"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <TodayQueue summary={summary} silenceAlerts={silenceAlerts} />
        <CashCollectionPanel summary={summary} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PipelinePanel summary={summary} />
        <ProjectRiskPanel summary={summary} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MaintenancePanel summary={summary} />
        <ExpensePressurePanel summary={summary} revenueData={dashboardData.revenueData} expenses={expenses} />
      </div>

      <GrowthOpportunitiesPanel summary={summary} />

      {summary.projectRisks.riskCount > 0 || summary.cash.totalOutstanding > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-spaceAccent/15 bg-space2/50 px-4 py-3 text-sm text-spaceAlt/85">
          <AlertTriangle className="h-4 w-4 text-yellow-200" />
          <span>{summary.projectRisks.riskCount + summary.cash.topCustomers.length} attention signal{summary.projectRisks.riskCount + summary.cash.topCustomers.length === 1 ? '' : 's'} need review before the next delivery block.</span>
          <ArrowUpRight className="h-4 w-4 text-spaceAccent" />
        </div>
      ) : null}
    </section>
  );
}
