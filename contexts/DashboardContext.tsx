'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { useAuthUid } from '@/hooks/use-auth-uid';

interface DashboardData {
  totalRevenue: number;
  activeProjects: number;
  totalCustomers: number;
  conversionRate: number;
  revenueData: any[];
  recentCustomers: any[];
  lastUpdated: Date | null;
}

interface DashboardContextType {
  dashboardData: DashboardData;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

function createRollingMonthTotals(quotes: any[], maintenanceInvoices: any[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const now = new Date();

  return months.map((_, index) => {
    const current = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const month = current.getMonth();
    const year = current.getFullYear();

    const quoteTotal = quotes.reduce((sum, quote) => {
      const createdAt = toDate(quote.createdAt ?? quote.created_at);
      if (!createdAt || createdAt.getMonth() !== month || createdAt.getFullYear() !== year) return sum;
      return sum + pickNumber(quote, ["totalAmount", "total_amount"], 0);
    }, 0);

    const invoiceTotal = maintenanceInvoices.reduce((sum, invoice) => {
      const invoiceDate = toDate(invoice.date ?? invoice.createdAt ?? invoice.created_at);
      if (!invoiceDate || invoiceDate.getMonth() !== month || invoiceDate.getFullYear() !== year) return sum;
      return sum + pickNumber(invoice, ["totalAmount", "total_amount"], 0);
    }, 0);

    return {
      name: current.toLocaleString('default', { month: 'short' }),
      total: quoteTotal + invoiceTotal,
    };
  });
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [acceptedQuotes, setAcceptedQuotes] = useState<any[]>([]);
  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [paidMaintenanceInvoices, setPaidMaintenanceInvoices] = useState<any[]>([]);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState({
    acceptedQuotes: false,
    allQuotes: false,
    maintenance: false,
    projects: false,
    customers: false,
  });

  const uid = useAuthUid();

  useEffect(() => {
    if (!uid) return;

    const unsubAcceptedQuotes = onSnapshot(
      query(collection(db, "quotes"), where("status", "==", "accepted")),
      (snapshot) => {
        setAcceptedQuotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoaded((prev) => ({ ...prev, acceptedQuotes: true }));
      }
    );

    const unsubAllQuotes = onSnapshot(collection(db, "quotes"), (snapshot) => {
      setAllQuotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoaded((prev) => ({ ...prev, allQuotes: true }));
    });

    const unsubMaintenance = onSnapshot(
      query(collection(db, "maintenance_invoices"), where("status", "==", "paid")),
      (snapshot) => {
        setPaidMaintenanceInvoices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoaded((prev) => ({ ...prev, maintenance: true }));
      }
    );

    const unsubProjects = onSnapshot(
      query(collection(db, "projects"), where("status", "==", "active")),
      (snapshot) => {
        setActiveProjectsCount(snapshot.size);
        setLoaded((prev) => ({ ...prev, projects: true }));
      }
    );

    const unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
      setCustomers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoaded((prev) => ({ ...prev, customers: true }));
    });

    return () => {
      unsubAcceptedQuotes();
      unsubAllQuotes();
      unsubMaintenance();
      unsubProjects();
      unsubCustomers();
    };
  }, [uid]);

  const dashboardData = useMemo<DashboardData>(() => {
    const quoteRevenue = acceptedQuotes.reduce((sum, quote) => {
      return sum + pickNumber(quote, ["totalAmount", "total_amount"], 0);
    }, 0);

    const maintenanceRevenue = paidMaintenanceInvoices.reduce((sum, invoice) => {
      return sum + pickNumber(invoice, ["totalAmount", "total_amount"], 0);
    }, 0);

    const acceptedCount = allQuotes.filter((quote) => quote.status === "accepted").length;
    const conversionRate = allQuotes.length > 0 ? (acceptedCount / allQuotes.length) * 100 : 0;

    const recentCustomers = [...customers]
      .filter((customer) => toDate(customer.createdAt ?? customer.created_at))
      .sort((a, b) => {
        const dateA = toDate(a.createdAt ?? a.created_at)?.getTime() ?? 0;
        const dateB = toDate(b.createdAt ?? b.created_at)?.getTime() ?? 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    return {
      totalRevenue: quoteRevenue + maintenanceRevenue,
      activeProjects: activeProjectsCount,
      totalCustomers: customers.length,
      conversionRate: Number(conversionRate.toFixed(1)),
      revenueData: createRollingMonthTotals(acceptedQuotes, paidMaintenanceInvoices),
      recentCustomers,
      lastUpdated: new Date(),
    };
  }, [acceptedQuotes, allQuotes, paidMaintenanceInvoices, activeProjectsCount, customers]);

  useEffect(() => {
    if (Object.values(loaded).every(Boolean)) {
      setLastUpdated(new Date());
      setIsLoading(false);
    }
  }, [loaded, dashboardData]);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <DashboardContext.Provider value={{ dashboardData, isLoading, refreshData, lastUpdated }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
