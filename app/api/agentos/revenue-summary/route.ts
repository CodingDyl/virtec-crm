import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAgentOSAuth, handleAgentOSAuthError } from '@/lib/agentos-auth';
import { normalizeQuote, toDate } from '@/lib/firestore-schema';
import {
  calculateMonthlyRecurringMaintenance,
  calculatePipelineSummary,
} from '@/lib/business-command-centre';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { MaintenanceInvoice } from '@/types/maintenance';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;

/**
 * GET /api/agentos/revenue-summary
 * 
 * Returns aggregated revenue summary for AgentOS.
 * Includes:
 *   - Monthly Recurring Revenue (MRR) from maintenance projects
 *   - Pending quote value
 *   - Accepted quote value this month
 *   - Active maintenance customers count
 *   - Upcoming maintenance invoices
 *   - Overdue invoice count
 * 
 * Excludes any credential or password fields.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAgentOSAuth(request);
  } catch (error) {
    return handleAgentOSAuthError(error);
  }

  try {
    const db = getAdminDb();
    const now = new Date();

    const [projectsSnap, quotesSnap, invoicesSnap] = await Promise.all([
      db.collection('projects').get(),
      db.collection('quotes').get(),
      db.collection('maintenance_invoices').get(),
    ]);

    const projects: Project[] = projectsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Project, 'id'>),
    }));

    const quotes: Quote[] = quotesSnap.docs.map((doc) =>
      normalizeQuote(doc.id, doc.data() as AnyRecord)
    );

    const invoices: MaintenanceInvoice[] = invoicesSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<MaintenanceInvoice, 'id'>),
    }));

    // Calculate maintenance revenue summary
    const maintenanceSummary = calculateMonthlyRecurringMaintenance(
      projects,
      invoices,
      now
    );

    // Calculate pipeline summary
    const pipelineSummary = calculatePipelineSummary(quotes, now);

    // Calculate total accepted revenue
    const acceptedQuotes = quotes.filter((q) => q.status === 'accepted');
    const totalAcceptedRevenue = acceptedQuotes.reduce((sum, quote) => {
      return sum + (quote.totalAmount || 0);
    }, 0);

    // Calculate paid maintenance invoices revenue
    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const totalMaintenanceRevenue = paidInvoices.reduce((sum, invoice) => {
      return sum + (invoice.totalAmount || 0);
    }, 0);

    const summary = {
      monthlyRecurringRevenue: maintenanceSummary.monthlyRecurringRevenue,
      activeMaintenanceCustomers: maintenanceSummary.activeMaintenanceCustomers,
      upcomingInvoicesCount: maintenanceSummary.upcomingInvoices.length,
      overdueInvoiceCount: maintenanceSummary.overdueInvoiceCount,
      pendingQuoteValue: pipelineSummary.pendingQuoteValue,
      acceptedQuoteValueThisMonth: pipelineSummary.acceptedQuoteValueThisMonth,
      totalAcceptedRevenue,
      totalMaintenanceRevenue,
      totalRevenue: totalAcceptedRevenue + totalMaintenanceRevenue,
      quoteConversionRate: pipelineSummary.conversionRate,
      stalePendingQuoteCount: pipelineSummary.stalePendingQuoteCount,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('AgentOS revenue-summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate revenue summary' },
      { status: 500 }
    );
  }
}
