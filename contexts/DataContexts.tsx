'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { REFRESH_INTERVAL } from '@/constants';
import { Customer } from '@/types/customer';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';

// Quotes Context
interface QuotesContextType {
  quotes: Quote[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
  projectNames: {[key: string]: string};
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

export function QuotesProvider({ children }: { children: React.ReactNode }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [projectNames, setProjectNames] = useState<{[key: string]: string}>({});

  const fetchQuotes = useCallback(async () => {
    const isInitialLoad = !lastUpdated;
    if (isInitialLoad) setIsLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, "quotes"));
      const quotesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      
      // Fetch project names
      const projectNamesMap: {[key: string]: string} = {};
      for (const quote of quotesData) {
        if (quote.project_id) {
          const projectDoc = await getDoc(doc(db, "projects", quote.project_id));
          if (projectDoc.exists()) {
            projectNamesMap[quote.project_id] = projectDoc.data().clientName;
          }
        }
      }

      setQuotes(quotesData);
      setProjectNames(projectNamesMap);
      setLastUpdated(new Date());
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [lastUpdated]);

  useEffect(() => {
    fetchQuotes();
    const intervalId = setInterval(fetchQuotes, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchQuotes]);

  return (
    <QuotesContext.Provider value={{ 
      quotes, 
      isLoading, 
      refreshData: fetchQuotes, 
      lastUpdated,
      projectNames 
    }}>
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

  const fetchProjects = useCallback(async () => {
    const isInitialLoad = !lastUpdated;
    if (isInitialLoad) setIsLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, "projects"));
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLastUpdated(new Date());
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [lastUpdated]);

  useEffect(() => {
    fetchProjects();
    const intervalId = setInterval(fetchProjects, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchProjects]);

  return (
    <ProjectsContext.Provider value={{ 
      projects, 
      isLoading, 
      refreshData: fetchProjects, 
      lastUpdated 
    }}>
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCustomers = useCallback(async () => {
    const isInitialLoad = !lastUpdated;
    if (isInitialLoad) setIsLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customersData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const projectsSnapshot = await getDocs(
          query(collection(db, "projects"), where("clientId", "==", doc.id))
        );
        
        let totalSpent = 0;
        for (const projectDoc of projectsSnapshot.docs) {
          const quotesSnapshot = await getDocs(
            query(collection(db, "quotes"), 
              where("project_id", "==", projectDoc.id),
              where("status", "==", "accepted")
            )
          );
          
          totalSpent += quotesSnapshot.docs.reduce((sum, quote) => 
            sum + (quote.data().total_amount || 0), 0
          );
        }

        return {
          id: doc.id,
          ...doc.data(),
          totalSpent,
        };
      }));
      
      setCustomers(customersData);
      setLastUpdated(new Date());
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [lastUpdated]);

  useEffect(() => {
    fetchCustomers();
    const intervalId = setInterval(fetchCustomers, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchCustomers]);

  return (
    <CustomersContext.Provider value={{ 
      customers, 
      isLoading, 
      refreshData: fetchCustomers, 
      lastUpdated 
    }}>
      {children}
    </CustomersContext.Provider>
  );
}

export function useCustomers() {
  const context = useContext(CustomersContext);
  if (!context) throw new Error('useCustomers must be used within CustomersProvider');
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

  const fetchSubscribers = useCallback(async () => {
    const isInitialLoad = !lastUpdated;
    if (isInitialLoad) setIsLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, "subscribers"));
      const subscribersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subscriber[];
      setSubscribers(subscribersData);
      setLastUpdated(new Date());
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [lastUpdated]);

  useEffect(() => {
    fetchSubscribers();
    const intervalId = setInterval(fetchSubscribers, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchSubscribers]);

  return (
    <SubscriptionsContext.Provider value={{ 
      subscribers, 
      isLoading, 
      refreshData: fetchSubscribers, 
      lastUpdated 
    }}>
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionsProvider');
  return context;
}