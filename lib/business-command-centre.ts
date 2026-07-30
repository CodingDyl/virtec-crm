import { differenceInCalendarDays, isSameMonth, isSameYear } from 'date-fns';
import { Expense } from '@/types/expense';
import { FollowUp } from '@/types/follow-up';
import { MaintenanceInvoice } from '@/types/maintenance';
import { Product } from '@/types/product';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { Customer } from '@/types/customer';
import { grossAmount, isWithin, monthRange, monthlyEquivalent } from '@/lib/expenses';
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { cyclesPerYear, isMaintenanceProject, nextDueDate } from '@/lib/maintenance';
import { effectiveDueDate, isFollowUpCurrentlyOpen } from '@/lib/follow-ups';

type AnyRecord = Record<string, any>;

export interface CashCollectionCustomer {
  customerId: string;
  customerName: string;
  amount: number;
  invoiceCount: number;
  oldestInvoiceDate: Date | null;
  invoices: MaintenanceInvoice[];
}

export interface CashToCollectSummary {
  totalOutstanding: number;
  oldestOverdueInvoice: MaintenanceInvoice | null;
  topCustomers: CashCollectionCustomer[];
}

export interface FollowUpSummary {
  openCount: number;
  dueTodayCount: number;
  overdueCount: number;
  highestValueFollowUp: FollowUp | null;
  todayQueue: FollowUp[];
}

export interface ActiveProjectValueSummary {
  totalActiveValue: number;
  activeProjectCount: number;
  largestActiveProject: Project | null;
  staleActiveProjectCount: number;
}

export interface MaintenanceRevenueSummary {
  monthlyRecurringRevenue: number;
  activeMaintenanceCustomers: number;
  upcomingInvoices: Array<{ project: Project; dueAt: Date; amount: number }>;
  overdueInvoiceCount: number;
}

export interface PipelineSummary {
  pendingQuoteValue: number;
  acceptedQuoteValueThisMonth: number;
  conversionRate: number;
  stalePendingQuoteCount: number;
  topPendingQuotes: Quote[];
}

export interface ProjectRisk {
  project: Project;
  reasons: string[];
  suggestedAction: string;
  amountAtRisk: number;
}

export interface ProjectRiskSummary {
  riskCount: number;
  topRisks: ProjectRisk[];
}

export interface ExpensePressureSummary {
  thisMonthExpenses: number;
  technologyDebitOrders: number;
  netMonthPosition: number;
  largestRecurringCost: Expense | null;
}

export interface GrowthOpportunity {
  id: string;
  title: string;
  customerName: string;
  projectName?: string;
  estimatedValue?: number;
  suggestedAction: string;
}

export interface CommandCentreSummary {
  cash: CashToCollectSummary;
  followUps: FollowUpSummary;
  activeProjectValue: ActiveProjectValueSummary;
  maintenance: MaintenanceRevenueSummary;
  pipeline: PipelineSummary;
  projectRisks: ProjectRiskSummary;
  expenses: ExpensePressureSummary;
  growthOpportunities: GrowthOpportunity[];
}

function normaliseStatus(status?: string | null): string {
  return (status ?? '').trim().toLowerCase();
}

function quoteAmount(quote: Quote | AnyRecord): number {
  return pickNumber(quote as AnyRecord, ['totalAmount', 'total_amount'], 0);
}

function quoteDate(quote: Quote | AnyRecord): Date | null {
  return toDate((quote as AnyRecord).createdAt ?? (quote as AnyRecord).created_at);
}

function projectDate(project: Project | AnyRecord): Date | null {
  return toDate((project as AnyRecord).updatedAt ?? (project as AnyRecord).updated_at ?? project.createdAt ?? (project as AnyRecord).created_at);
}

function projectValue(project: Project, quotesByProject: Map<string, Quote[]>): number {
  if (typeof project.amount === 'number' && Number.isFinite(project.amount)) {
    return project.amount;
  }

  return (quotesByProject.get(project.id) ?? [])
    .filter((quote) => quote.status === 'accepted')
    .reduce((sum, quote) => sum + quoteAmount(quote), 0);
}

function customerLabel(customer?: Customer | null): string {
  if (!customer) return 'Unknown customer';
  return customer.companyName || customer.name || 'Unknown customer';
}

function companyKey(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function calculateCashToCollect(invoices: MaintenanceInvoice[]): CashToCollectSummary {
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== 'paid');
  const topCustomersMap = new Map<string, CashCollectionCustomer>();

  unpaidInvoices.forEach((invoice) => {
    const customerId = invoice.clientId || invoice.company || 'unknown';
    const customerName = invoice.company || 'Unknown customer';
    const issuedAt = toDate(invoice.date);
    const current = topCustomersMap.get(customerId) ?? {
      customerId,
      customerName,
      amount: 0,
      invoiceCount: 0,
      oldestInvoiceDate: null,
      invoices: [],
    };

    topCustomersMap.set(customerId, {
      ...current,
      amount: current.amount + invoice.totalAmount,
      invoiceCount: current.invoiceCount + 1,
      oldestInvoiceDate:
        issuedAt && (!current.oldestInvoiceDate || issuedAt < current.oldestInvoiceDate)
          ? issuedAt
          : current.oldestInvoiceDate,
      invoices: [...current.invoices, invoice],
    });
  });

  const oldestOverdueInvoice = [...unpaidInvoices].sort((a, b) => {
    return (toDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (toDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER);
  })[0] ?? null;

  return {
    totalOutstanding: unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
    oldestOverdueInvoice,
    topCustomers: [...topCustomersMap.values()]
      .sort((a, b) => {
        const byDate = (a.oldestInvoiceDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.oldestInvoiceDate?.getTime() ?? Number.MAX_SAFE_INTEGER);
        return byDate || b.amount - a.amount;
      })
      .slice(0, 5),
  };
}

export function calculateFollowUpSummary(followUps: FollowUp[], now = new Date()): FollowUpSummary {
  const openFollowUps = followUps.filter((followUp) => isFollowUpCurrentlyOpen(followUp, now));
  const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dueToday = openFollowUps.filter((followUp) => {
    const dueAt = effectiveDueDate(followUp);
    return dueAt && new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate()).getTime() === todayKey;
  });

  const overdue = openFollowUps.filter((followUp) => {
    const dueAt = effectiveDueDate(followUp);
    return dueAt && new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate()).getTime() < todayKey;
  });

  return {
    openCount: openFollowUps.length,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    highestValueFollowUp: [...openFollowUps].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0] ?? null,
    todayQueue: [...overdue, ...dueToday]
      .sort((a, b) => (effectiveDueDate(a)?.getTime() ?? 0) - (effectiveDueDate(b)?.getTime() ?? 0))
      .slice(0, 6),
  };
}

export function calculateActiveProjectValue(projects: Project[], quotes: Quote[], now = new Date()): ActiveProjectValueSummary {
  const quotesByProject = new Map<string, Quote[]>();
  quotes.forEach((quote) => {
    const existing = quotesByProject.get(quote.projectId) ?? [];
    quotesByProject.set(quote.projectId, [...existing, quote]);
  });

  const activeProjects = projects.filter((project) => normaliseStatus(project.status) === 'active');
  const largestActiveProject = [...activeProjects].sort((a, b) => projectValue(b, quotesByProject) - projectValue(a, quotesByProject))[0] ?? null;

  return {
    totalActiveValue: activeProjects.reduce((sum, project) => sum + projectValue(project, quotesByProject), 0),
    activeProjectCount: activeProjects.length,
    largestActiveProject,
    staleActiveProjectCount: activeProjects.filter((project) => {
      const lastMovement = projectDate(project);
      return lastMovement ? differenceInCalendarDays(now, lastMovement) >= 7 : true;
    }).length,
  };
}

export function calculateMonthlyRecurringMaintenance(
  projects: Project[],
  invoices: MaintenanceInvoice[],
  now = new Date()
): MaintenanceRevenueSummary {
  const maintenanceProjects = projects.filter((project) => normaliseStatus(project.status) !== 'completed' && isMaintenanceProject(project));
  const invoicesByProject = new Map<string, MaintenanceInvoice[]>();
  invoices.forEach((invoice) => {
    const existing = invoicesByProject.get(invoice.projectId) ?? [];
    invoicesByProject.set(invoice.projectId, [...existing, invoice]);
  });

  const upcomingInvoices = maintenanceProjects.flatMap((project) => {
    const projectInvoices = invoicesByProject.get(project.id) ?? [];
    const latestInvoiceDate = projectInvoices.reduce<Date | null>((latest, invoice) => {
      const issuedAt = toDate(invoice.date);
      return issuedAt && (!latest || issuedAt > latest) ? issuedAt : latest;
    }, null);
    const dueAt = nextDueDate(project.maintenanceFrequency, latestInvoiceDate);
    const isUpcoming = dueAt && differenceInCalendarDays(dueAt, now) >= 0 && differenceInCalendarDays(dueAt, now) <= 14;
    return isUpcoming ? [{ project, dueAt, amount: project.maintenanceAmount ?? 0 }] : [];
  });

  return {
    monthlyRecurringRevenue: maintenanceProjects.reduce((sum, project) => {
      return sum + ((project.maintenanceAmount ?? 0) * cyclesPerYear(project.maintenanceFrequency)) / 12;
    }, 0),
    activeMaintenanceCustomers: new Set(maintenanceProjects.map((project) => project.clientId || project.clientName)).size,
    upcomingInvoices: upcomingInvoices.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()).slice(0, 5),
    overdueInvoiceCount: invoices.filter((invoice) => invoice.status !== 'paid' && toDate(invoice.date) && differenceInCalendarDays(now, toDate(invoice.date) as Date) >= 7).length,
  };
}

export function calculatePipelineSummary(quotes: Quote[], now = new Date()): PipelineSummary {
  const pendingQuotes = quotes.filter((quote) => quote.status === 'pending');
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'accepted');

  return {
    pendingQuoteValue: pendingQuotes.reduce((sum, quote) => sum + quoteAmount(quote), 0),
    acceptedQuoteValueThisMonth: acceptedQuotes.reduce((sum, quote) => {
      const createdAt = quoteDate(quote);
      return createdAt && isSameMonth(createdAt, now) && isSameYear(createdAt, now) ? sum + quoteAmount(quote) : sum;
    }, 0),
    conversionRate: quotes.length > 0 ? (acceptedQuotes.length / quotes.length) * 100 : 0,
    stalePendingQuoteCount: pendingQuotes.filter((quote) => {
      const createdAt = quoteDate(quote);
      return createdAt ? differenceInCalendarDays(now, createdAt) > 3 : false;
    }).length,
    topPendingQuotes: [...pendingQuotes].sort((a, b) => quoteAmount(b) - quoteAmount(a)).slice(0, 5),
  };
}

export function calculateProjectRisks(projects: Project[], quotes: Quote[], expenses: Expense[], now = new Date()): ProjectRiskSummary {
  const quotesByProject = new Map<string, Quote[]>();
  quotes.forEach((quote) => {
    const existing = quotesByProject.get(quote.projectId) ?? [];
    quotesByProject.set(quote.projectId, [...existing, quote]);
  });

  const expensesByProject = new Map<string, number>();
  expenses.forEach((expense) => {
    if (!expense.projectId) return;
    expensesByProject.set(expense.projectId, (expensesByProject.get(expense.projectId) ?? 0) + grossAmount(expense));
  });

  const risks = projects
    .filter((project) => !['completed', 'cancelled'].includes(normaliseStatus(project.status)))
    .map<ProjectRisk | null>((project) => {
      const reasons: string[] = [];
      const status = normaliseStatus(project.status);
      const completion = project.completion ?? 0;
      const createdAt = toDate(project.createdAt);
      const lastMovement = projectDate(project);
      const amountAtRisk = projectValue(project, quotesByProject);
      const expensesTotal = expensesByProject.get(project.id) ?? 0;
      const agreement = project.agreementStatus ?? (project.agreementUrl || project.agreementPath ? 'signed' : 'pending');

      if (status.includes('hold') || status.includes('blocked')) reasons.push('Blocked or on hold');
      if (lastMovement ? differenceInCalendarDays(now, lastMovement) >= 7 : status === 'active') reasons.push('No recorded movement in 7 days');
      if (createdAt && completion < 40 && differenceInCalendarDays(now, createdAt) > 14) reasons.push('Low progress for project age');
      if (amountAtRisk > 0 && expensesTotal / amountAtRisk >= 0.7) reasons.push('Costs exceed 70% of project value');
      if (agreement !== 'signed' && agreement !== 'approved') reasons.push('Agreement not approved');

      if (reasons.length === 0) return null;

      return {
        project,
        reasons,
        amountAtRisk,
        suggestedAction: reasons.includes('Costs exceed 70% of project value')
          ? 'Review scope, logged costs, and any client-rebillable expenses.'
          : reasons.includes('Agreement not approved')
            ? 'Get the agreement approved before more delivery work continues.'
            : 'Confirm the blocker and log the next client or delivery action.',
      };
    })
    .filter((risk): risk is ProjectRisk => Boolean(risk))
    .sort((a, b) => b.reasons.length - a.reasons.length || b.amountAtRisk - a.amountAtRisk);

  return {
    riskCount: risks.length,
    topRisks: risks.slice(0, 5),
  };
}

export function calculateExpensePressure(expenses: Expense[], monthlyRevenue: number, now = new Date()): ExpensePressureSummary {
  const currentMonth = monthRange(now);
  const thisMonthExpenses = expenses
    .filter((expense) => isWithin(toDate(expense.date), currentMonth.start, currentMonth.end))
    .reduce((sum, expense) => sum + grossAmount(expense), 0);

  const technologyNeedles = ['hosting', 'software', 'firebase', 'vercel', 'domain', 'email', 'subscription', 'subscriptions', 'tool', 'tools'];
  const technologyDebitOrders = expenses
    .filter((expense) => {
      const text = `${expense.category} ${expense.vendor} ${expense.description}`.toLowerCase();
      return expense.recurrence !== 'none' && technologyNeedles.some((needle) => text.includes(needle));
    })
    .reduce((sum, expense) => sum + monthlyEquivalent(expense), 0);

  const largestRecurringCost = [...expenses]
    .filter((expense) => expense.recurrence !== 'none')
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0] ?? null;

  return {
    thisMonthExpenses,
    technologyDebitOrders,
    netMonthPosition: monthlyRevenue - thisMonthExpenses,
    largestRecurringCost,
  };
}

export function calculateGrowthOpportunities(
  customers: Customer[],
  projects: Project[],
  quotes: Quote[],
  products: Product[],
  now = new Date()
): GrowthOpportunity[] {
  const projectsByCustomer = new Map<string, Project[]>();
  projects.forEach((project) => {
    const key = project.clientId || companyKey(project.clientName);
    if (!key) return;
    projectsByCustomer.set(key, [...(projectsByCustomer.get(key) ?? []), project]);
  });

  const quotesByCustomer = new Map<string, Quote[]>();
  quotes.forEach((quote) => {
    const key = quote.clientId;
    if (!key) return;
    quotesByCustomer.set(key, [...(quotesByCustomer.get(key) ?? []), quote]);
  });

  const opportunities: GrowthOpportunity[] = [];
  customers.forEach((customer) => {
    const keys = [customer.id, companyKey(customer.companyName)].filter(Boolean) as string[];
    const customerProjects = keys.flatMap((key) => projectsByCustomer.get(key) ?? []);
    const customerQuotes = keys.flatMap((key) => quotesByCustomer.get(key) ?? []);
    const completedProjects = customerProjects.filter((project) => normaliseStatus(project.status) === 'completed');
    const maintenanceProjects = customerProjects.filter((project) => isMaintenanceProject(project));
    const latestProjectDate = customerProjects.reduce<Date | null>((latest, project) => {
      const date = projectDate(project);
      return date && (!latest || date > latest) ? date : latest;
    }, null);
    const rejectedQuote = [...customerQuotes].filter((quote) => quote.status === 'rejected').sort((a, b) => (quoteDate(b)?.getTime() ?? 0) - (quoteDate(a)?.getTime() ?? 0))[0];

    if (completedProjects.length > 0 && maintenanceProjects.length === 0) {
      const project = completedProjects[0];
      opportunities.push({
        id: `maintenance-upsell:${customer.id ?? customer.companyName}`,
        title: 'Offer maintenance retainer',
        customerName: customerLabel(customer),
        projectName: project.projectType,
        estimatedValue: Math.max((project.amount ?? 0) * 0.08, 1500),
        suggestedAction: 'Package hosting, updates, uptime checks, and monthly support in Rand pricing.',
      });
    }

    if (maintenanceProjects.length > 0 && latestProjectDate && differenceInCalendarDays(now, latestProjectDate) > 60) {
      opportunities.push({
        id: `quarterly-review:${customer.id ?? customer.companyName}`,
        title: 'Book a quarterly account review',
        customerName: customerLabel(customer),
        estimatedValue: maintenanceProjects.reduce((sum, project) => sum + (project.maintenanceAmount ?? 0), 0),
        suggestedAction: 'Review site performance, new compliance needs, and small improvements.',
      });
    }

    if (rejectedQuote) {
      opportunities.push({
        id: `smaller-package:${rejectedQuote.id}`,
        title: 'Rework rejected quote into a smaller starter package',
        customerName: customerLabel(customer),
        projectName: rejectedQuote.projectType,
        estimatedValue: quoteAmount(rejectedQuote) * 0.55,
        suggestedAction: 'Offer a phased version with lower upfront cost and a clear upgrade path.',
      });
    }

    if ((customer.totalSpent ?? 0) > 0 && latestProjectDate && differenceInCalendarDays(now, latestProjectDate) > 60) {
      opportunities.push({
        id: `inactive-high-value:${customer.id ?? customer.companyName}`,
        title: 'Check in with inactive high-value client',
        customerName: customerLabel(customer),
        estimatedValue: customer.totalSpent * 0.15,
        suggestedAction: 'Ask what changed in the business and suggest one practical improvement.',
      });
    }

    if (completedProjects.length > 0 && products.length > 0) {
      opportunities.push({
        id: `testimonial:${customer.id ?? customer.companyName}`,
        title: 'Request case study or testimonial',
        customerName: customerLabel(customer),
        projectName: completedProjects[0].projectType,
        suggestedAction: 'Ask for a short testimonial that can support local South African sales conversations.',
      });
    }
  });

  return opportunities
    .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
    .slice(0, 6);
}

export function buildCommandCentreSummary(args: {
  customers: Customer[];
  projects: Project[];
  quotes: Quote[];
  expenses: Expense[];
  invoices: MaintenanceInvoice[];
  products: Product[];
  followUps: FollowUp[];
  now?: Date;
}): CommandCentreSummary {
  const now = args.now ?? new Date();
  const pipeline = calculatePipelineSummary(args.quotes, now);

  return {
    cash: calculateCashToCollect(args.invoices),
    followUps: calculateFollowUpSummary(args.followUps, now),
    activeProjectValue: calculateActiveProjectValue(args.projects, args.quotes, now),
    maintenance: calculateMonthlyRecurringMaintenance(args.projects, args.invoices, now),
    pipeline,
    projectRisks: calculateProjectRisks(args.projects, args.quotes, args.expenses, now),
    expenses: calculateExpensePressure(args.expenses, pipeline.acceptedQuoteValueThisMonth, now),
    growthOpportunities: calculateGrowthOpportunities(args.customers, args.projects, args.quotes, args.products, now),
  };
}
