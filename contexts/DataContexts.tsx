'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { Expense } from '@/types/expense';
import { Product } from '@/types/product';
import { MaintenanceInvoice } from '@/types/maintenance';
import { normalizeQuote, pickNumber, toDate } from '@/lib/firestore-schema';
import { normalizeExpense } from '@/lib/expenses';
import { normalizeMaintenanceInvoice } from '@/lib/maintenance';

// Quotes Context
interface QuotesContextType {
  quotes: Quote[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
  projectNames: { [key: string]: string };
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

export function QuotesProvider({ children }: { children: React.ReactNode }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, "projects"), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.docs.forEach((doc) => {
        map[doc.id] = doc.data();
      });
      setProjectsById(map);
    });

    const unsubQuotes = onSnapshot(collection(db, "quotes"), (snapshot) => {
      const quotesData = snapshot.docs.map((doc) => normalizeQuote(doc.id, doc.data()));
      setQuotes(quotesData);
      setLastUpdated(new Date());
      setIsLoading(false);
    });

    return () => {
      unsubProjects();
      unsubQuotes();
    };
  }, []);

  const projectNames = useMemo(() => {
    const names: Record<string, string> = {};
    Object.entries(projectsById).forEach(([id, project]) => {
      names[id] = project.clientName ?? project.companyName ?? project.projectType ?? "Unknown Project";
    });
    return names;
  }, [projectsById]);

  const refreshData = async () => {
    // Realtime subscriptions keep data synced; this updates the "last updated" signal.
    setLastUpdated(new Date());
  };

  return (
    <QuotesContext.Provider value={{ quotes, isLoading, refreshData, lastUpdated, projectNames }}>
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotes() {
  const context = useContext(QuotesContext);
  if (!context) throw new Error('useQuotes must be used within QuotesProvider');
  return context;
}

// Projects Context
interface ProjectsContextType {
  projects: Project[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "projects"), (snapshot) => {
      const projectsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];
      setProjects(projectsData);
      setLastUpdated(new Date());
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <ProjectsContext.Provider value={{ projects, isLoading, refreshData, lastUpdated }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error('useProjects must be used within ProjectsProvider');
  return context;
}

// Customers Context
interface CustomersContextType {
  customers: Customer[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customersRaw, setCustomersRaw] = useState<any[]>([]);
  const [projectsRaw, setProjectsRaw] = useState<any[]>([]);
  const [acceptedQuotesRaw, setAcceptedQuotesRaw] = useState<any[]>([]);
  const [loadedCollections, setLoadedCollections] = useState({
    customers: false,
    projects: false,
    quotes: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
      setCustomersRaw(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoadedCollections((prev) => ({ ...prev, customers: true }));
    });

    const unsubProjects = onSnapshot(collection(db, "projects"), (snapshot) => {
      setProjectsRaw(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoadedCollections((prev) => ({ ...prev, projects: true }));
    });

    const unsubQuotes = onSnapshot(
      query(collection(db, "quotes"), where("status", "==", "accepted")),
      (snapshot) => {
        setAcceptedQuotesRaw(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoadedCollections((prev) => ({ ...prev, quotes: true }));
      }
    );

    return () => {
      unsubCustomers();
      unsubProjects();
      unsubQuotes();
    };
  }, []);

  const customers = useMemo(() => {
    const projectsByClient = new Map<string, string[]>();
    projectsRaw.forEach((project) => {
      const clientId = project.clientId;
      if (!clientId) return;
      const existing = projectsByClient.get(clientId) ?? [];
      existing.push(project.id);
      projectsByClient.set(clientId, existing);
    });

    const quoteTotalByProject = new Map<string, number>();
    acceptedQuotesRaw.forEach((quote) => {
      const projectId = quote.projectId ?? quote.project_id;
      if (!projectId) return;
      const current = quoteTotalByProject.get(projectId) ?? 0;
      quoteTotalByProject.set(projectId, current + pickNumber(quote, ["totalAmount", "total_amount"], 0));
    });

    return customersRaw.map((customer) => {
      const customerProjectIds = projectsByClient.get(customer.id) ?? [];
      const totalSpent = customerProjectIds.reduce((sum, projectId) => {
        return sum + (quoteTotalByProject.get(projectId) ?? 0);
      }, 0);

      return {
        ...customer,
        createdAt: customer.createdAt ?? customer.created_at ?? null,
        totalSpent,
      };
    }) as Customer[];
  }, [acceptedQuotesRaw, customersRaw, projectsRaw]);

  useEffect(() => {
    if (!loadedCollections.customers || !loadedCollections.projects || !loadedCollections.quotes) {
      return;
    }
    setLastUpdated(new Date());
    setIsLoading(false);
  }, [customersRaw, projectsRaw, acceptedQuotesRaw, loadedCollections]);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <CustomersContext.Provider value={{ customers, isLoading, refreshData, lastUpdated }}>
      {children}
    </CustomersContext.Provider>
  );
}

export function useCustomers() {
  const context = useContext(CustomersContext);
  if (!context) throw new Error('useCustomers must be used within CustomersProvider');
  return context;
}

// Expenses Context
interface ExpensesContextType {
  expenses: Expense[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const ExpensesContext = createContext<ExpensesContextType | undefined>(undefined);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // No orderBy in the query (avoids an index); newest-first sorting is client-side.
    const unsubscribe = onSnapshot(
      collection(db, "expenses"),
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => normalizeExpense(doc.id, doc.data()));
        rows.sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));
        setExpenses(rows);
        setLastUpdated(new Date());
        setIsLoading(false);
      },
      (error) => {
        console.error('expenses snapshot error', error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <ExpensesContext.Provider value={{ expenses, isLoading, refreshData, lastUpdated }}>
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses must be used within ExpensesProvider');
  return context;
}

// Maintenance Invoices Context
interface MaintenanceInvoicesContextType {
  invoices: MaintenanceInvoice[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const MaintenanceInvoicesContext = createContext<MaintenanceInvoicesContextType | undefined>(undefined);

/**
 * Maintenance invoices are read from two places at once — the Maintenance Table
 * and each maintenance project's workspace tab — so they live in one realtime
 * subscription. Marking an invoice paid anywhere updates every total on screen.
 */
export function MaintenanceInvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = useState<MaintenanceInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // No orderBy in the query (avoids an index); newest-first sorting is client-side.
    const unsubscribe = onSnapshot(
      collection(db, 'maintenance_invoices'),
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => normalizeMaintenanceInvoice(doc.id, doc.data()));
        rows.sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));
        setInvoices(rows);
        setLastUpdated(new Date());
        setIsLoading(false);
      },
      (error) => {
        console.error('maintenance_invoices snapshot error', error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <MaintenanceInvoicesContext.Provider value={{ invoices, isLoading, refreshData, lastUpdated }}>
      {children}
    </MaintenanceInvoicesContext.Provider>
  );
}

export function useMaintenanceInvoices() {
  const context = useContext(MaintenanceInvoicesContext);
  if (!context) throw new Error('useMaintenanceInvoices must be used within MaintenanceInvoicesProvider');
  return context;
}

// Products Context
interface ProductsContextType {
  products: Product[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

/** Virtara's own products, kept separate from client projects. */
export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name ?? 'Untitled',
            tagline: data.tagline ?? '',
            stage: (data.stage ?? 'idea') as Product['stage'],
            notes: data.notes ?? '',
            links: Array.isArray(data.links) ? data.links : [],
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          } satisfies Product;
        });
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(rows);
        setLastUpdated(new Date());
        setIsLoading(false);
      },
      (error) => {
        console.error('products snapshot error', error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <ProductsContext.Provider value={{ products, isLoading, refreshData, lastUpdated }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) throw new Error('useProducts must be used within ProductsProvider');
  return context;
}

// Subscriptions Context
interface Subscriber {
  id: string;
  name: string;
  email: string;
  dateSubscribed: any;
  unsubscribed: boolean;
}

interface SubscriptionsContextType {
  subscribers: Subscriber[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const SubscriptionsContext = createContext<SubscriptionsContextType | undefined>(undefined);

export function SubscriptionsProvider({ children }: { children: React.ReactNode }) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "subscribers"), (snapshot) => {
      const subscribersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Subscriber[];
      setSubscribers(subscribersData);
      setLastUpdated(new Date());
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshData = async () => {
    setLastUpdated(new Date());
  };

  return (
    <SubscriptionsContext.Provider value={{ subscribers, isLoading, refreshData, lastUpdated }}>
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionsProvider');
  return context;
}
