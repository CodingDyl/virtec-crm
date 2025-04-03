'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';

interface DashboardData {
  totalRevenue: number;
  activeProjects: number;
  totalCustomers: number;
  conversionRate: number;
  revenueData: any[];
  recentCustomers: any[];
  lastUpdated: Date | null;
}

interface Customer {
  id: string;
  created_at: Timestamp;
  // add other customer fields as needed
}

interface DashboardContextType {
  dashboardData: DashboardData;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  lastUpdated: Date | null;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalRevenue: 0,
    activeProjects: 0,
    totalCustomers: 0,
    conversionRate: 0,
    revenueData: [],
    recentCustomers: [],
    lastUpdated: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const generateMonthlyRevenueData = async () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentMonth = new Date().getMonth();
    
    const quotesSnapshot = await getDocs(
      query(collection(db, "quotes"), 
      where("status", "==", "accepted"))
    );

    return months.map((month, index) => ({
      name: month,
      total: quotesSnapshot.docs
        .filter(doc => {
          const quoteDate = doc.data().created_at.toDate();
          return quoteDate.getMonth() === ((currentMonth - (5 - index)) % 12);
        })
        .reduce((sum, doc) => sum + (doc.data().total_amount || 0), 0)
    }));
  };

  const fetchDashboardData = useCallback(async () => {
    // Don't set loading to true for auto-refresh updates
    const isInitialLoad = !lastUpdated;
    if (isInitialLoad) {
      setIsLoading(true);
    }

    try {
      // Fetch Quotes for Revenue
      const quotesSnapshot = await getDocs(
        query(collection(db, "quotes"), 
        where("status", "==", "accepted"))
      );
      const totalRev = quotesSnapshot.docs.reduce((sum, doc) => 
        sum + (doc.data().total_amount || 0), 0
      );

      // Fetch Active Projects
      const projectsSnapshot = await getDocs(
        query(collection(db, "projects"), 
        where("status", "==", "active"))
      );

      // Fetch Total Customers
      const customersSnapshot = await getDocs(collection(db, "customers"));

      // Calculate Conversion Rate
      const allQuotesSnapshot = await getDocs(collection(db, "quotes"));
      const acceptedQuotes = allQuotesSnapshot.docs.filter(doc => 
        doc.data().status === "accepted"
      ).length;
      const convRate = (acceptedQuotes / allQuotesSnapshot.size) * 100;

      // Get Recent Customers
      const recentCustomersData = customersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Customer))
        .filter(customer => customer.created_at && customer.created_at.toDate) // Filter out invalid entries
        .sort((a, b) => {
          try {
            return b.created_at.toDate().getTime() - a.created_at.toDate().getTime();
          } catch (error) {
            console.warn(`Error sorting customer dates for IDs ${a.id} and ${b.id}:`, error);
            return 0; // Keep relative order unchanged in case of error
          }
        })
        .slice(0, 5);

      // Generate Revenue Data
      const monthlyRevenue = await generateMonthlyRevenueData();

      setDashboardData({
        totalRevenue: totalRev,
        activeProjects: projectsSnapshot.size,
        totalCustomers: customersSnapshot.size,
        conversionRate: Number(convRate.toFixed(1)),
        revenueData: monthlyRevenue,
        recentCustomers: recentCustomersData,
        lastUpdated: new Date()
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [lastUpdated]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Set up periodic refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  // Add visibility change handler to refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData]);

  return (
    <DashboardContext.Provider value={{ 
      dashboardData, 
      isLoading, 
      refreshData: fetchDashboardData,
      lastUpdated 
    }}>
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