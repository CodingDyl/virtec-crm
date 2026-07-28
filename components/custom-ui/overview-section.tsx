'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, 
  BarChart3, 
  Users, 
  ArrowUpRight, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Settings,
  Calendar,
  Target,
  Zap,
  Activity,
  PieChart,
  RefreshCw,
  Plus,
  Mail,
  Download,
  Eye
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Line, LineChart, PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, CartesianGrid } from "recharts";
import { useDashboard } from "@/contexts/DashboardContext";
import { useCustomers } from "@/contexts/DataContexts";
import { useProjects } from "@/contexts/DataContexts";
import { useQuotes } from "@/contexts/DataContexts";
import { useExpenses } from "@/contexts/DataContexts";
import { formatZAR, monthlySpendSeries, monthlyEquivalent, grossAmount, isWithin, monthRange } from "@/lib/expenses";
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { pickNumber, toDate } from '@/lib/firestore-schema';

interface EnhancedDashboardData {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  activeProjects: number;
  completedProjects: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  conversionRate: number;
  avgProjectValue: number;
  outstandingInvoices: number;
  maintenanceRevenue: number;
  topPerformingCustomers: any[];
  recentActivity: any[];
  projectStatusBreakdown: any[];
  revenueData: any[];
  lastUpdated: Date | null;
  pendingQuotes: number;
  overdueInvoices: number;
  avgCustomerValue: number;
}

export default function OverviewSection() {
  const { dashboardData, isLoading, lastUpdated, refreshData } = useDashboard();
  const { customers } = useCustomers();
  const { projects } = useProjects();
  const { quotes } = useQuotes();
  const { expenses } = useExpenses();
  const [enhancedData, setEnhancedData] = useState<EnhancedDashboardData>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalCustomers: 0,
    newCustomersThisMonth: 0,
    conversionRate: 0,
    avgProjectValue: 0,
    outstandingInvoices: 0,
    maintenanceRevenue: 0,
    topPerformingCustomers: [],
    recentActivity: [],
    projectStatusBreakdown: [],
    revenueData: [],
    lastUpdated: null,
    pendingQuotes: 0,
    overdueInvoices: 0,
    avgCustomerValue: 0
  });

  // Calculate enhanced metrics
  useEffect(() => {
    if (!isLoading && dashboardData) {
      const calculateEnhancedMetrics = async () => {
        try {
          // Calculate monthly revenue and growth
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

          const monthlyRevenue = dashboardData.revenueData
            .filter((item, index) => {
              const monthIndex = (currentMonth - (5 - index)) % 12;
              return monthIndex === currentMonth;
            })
            .reduce((sum, item) => sum + item.total, 0);

          const lastMonthRevenue = dashboardData.revenueData
            .filter((item, index) => {
              const monthIndex = (currentMonth - (5 - index)) % 12;
              return monthIndex === lastMonth;
            })
            .reduce((sum, item) => sum + item.total, 0);

          const revenueGrowth = lastMonthRevenue > 0 
            ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
            : 0;

          // Calculate project metrics
          const activeProjects = projects.filter(p => p.status === 'active').length;
          const completedProjects = projects.filter(p => p.status === 'completed').length;
          const avgProjectValue = dashboardData.totalRevenue / Math.max(completedProjects, 1);

          // Calculate customer metrics
          const newCustomersThisMonth = customers.filter(c => {
            const customerCreatedAt = c.createdAt ?? c.created_at;
            if (!customerCreatedAt) return false;
            try {
              const createdDate = customerCreatedAt.toDate();
              return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
            } catch (error) {
              return false;
            }
          }).length;

          // Calculate outstanding invoices
          const maintenanceInvoicesSnapshot = await getDocs(
            query(collection(db, "maintenance_invoices"), 
              where("status", "in", ["pending", "emailed"]))
          );
          const outstandingInvoices = maintenanceInvoicesSnapshot.docs.reduce((sum, doc) => 
            sum + (doc.data().totalAmount || 0), 0
          );

          // Calculate maintenance revenue
          const paidMaintenanceSnapshot = await getDocs(
            query(collection(db, "maintenance_invoices"), 
              where("status", "==", "paid"))
          );
          const maintenanceRevenue = paidMaintenanceSnapshot.docs.reduce((sum, doc) => 
            sum + (doc.data().totalAmount || 0), 0
          );

          // Calculate pending quotes
          const pendingQuotes = quotes.filter(q => q.status === 'pending').length;

          // Calculate overdue invoices (simplified - invoices older than 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const overdueInvoices = maintenanceInvoicesSnapshot.docs.filter(doc => {
            const docData = doc.data();
            const docDate = docData.date?.toDate();
            return docDate && docDate < thirtyDaysAgo;
          }).length;

          // Calculate average customer value
          const totalCustomerSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
          const avgCustomerValue = customers.length > 0 ? totalCustomerSpent / customers.length : 0;

          // Get top performing customers
          const topPerformingCustomers = customers
            .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
            .slice(0, 5)
            .map(c => ({
              name: c.name,
              company: c.companyName,
              totalSpent: c.totalSpent || 0,
              projects: projects.filter(p => p.clientName === c.companyName).length
            }));

          // Get recent activity
          const recentQuotes = quotes
            .sort((a, b) => {
              const dateB = toDate((b as any).createdAt ?? b.created_at)?.getTime() ?? 0;
              const dateA = toDate((a as any).createdAt ?? a.created_at)?.getTime() ?? 0;
              return dateB - dateA;
            })
            .slice(0, 5);

          const recentActivity = recentQuotes.map(q => ({
            type: 'quote',
            title: `Quote for ${(q as any).projectType ?? q.project_type}`,
            amount: pickNumber(q as any, ["totalAmount", "total_amount"], 0),
            status: q.status,
            date: toDate((q as any).createdAt ?? q.created_at) ?? new Date(),
            description: `R${pickNumber(q as any, ["totalAmount", "total_amount"], 0).toLocaleString()} - ${q.status}`
          }));

          // Project status breakdown - handle all possible statuses
          const projectStatuses = projects.reduce((acc, project) => {
            acc[project.status] = (acc[project.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const projectStatusBreakdown = [
            { name: 'Active', value: projectStatuses['active'] || 0, color: '#8df6ff' },
            { name: 'Completed', value: projectStatuses['completed'] || 0, color: '#4ade80' },
            { name: 'Planning', value: projectStatuses['planning'] || 0, color: '#4ea4ff' },
            { name: 'On Hold', value: projectStatuses['on-hold'] || 0, color: '#fbbf24' }
          ].filter(status => status.value > 0); // Only show statuses that have projects

          setEnhancedData({
            totalRevenue: dashboardData.totalRevenue,
            monthlyRevenue,
            revenueGrowth,
            activeProjects,
            completedProjects,
            totalCustomers: dashboardData.totalCustomers,
            newCustomersThisMonth,
            conversionRate: dashboardData.conversionRate,
            avgProjectValue,
            outstandingInvoices,
            maintenanceRevenue,
            topPerformingCustomers,
            recentActivity,
            projectStatusBreakdown,
            revenueData: dashboardData.revenueData,
            lastUpdated: dashboardData.lastUpdated,
            pendingQuotes,
            overdueInvoices,
            avgCustomerValue
          });
        } catch (error) {
          console.error("Error calculating enhanced metrics:", error);
        }
      };

      calculateEnhancedMetrics();
    }
  }, [dashboardData, isLoading, customers, projects, quotes]);

  // Revenue on its own hides the business. Line the two series up month by month.
  const profitSeries = useMemo(() => {
    const spend = monthlySpendSeries(expenses, 6);
    return (enhancedData.revenueData ?? []).map((month, index) => {
      const expenseTotal = spend[index]?.total ?? 0;
      return {
        name: month.name,
        revenue: month.total ?? 0,
        expenses: expenseTotal,
        profit: (month.total ?? 0) - expenseTotal,
      };
    });
  }, [enhancedData.revenueData, expenses]);

  const expenseSummary = useMemo(() => {
    const thisMonth = monthRange();
    const spentThisMonth = expenses
      .filter((e) => isWithin(toDate(e.date), thisMonth.start, thisMonth.end))
      .reduce((sum, e) => sum + grossAmount(e), 0);
    const fixedMonthlyBurn = expenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0);
    const lastFull = profitSeries.at(-1);

    return {
      spentThisMonth,
      fixedMonthlyBurn,
      latestProfit: lastFull?.profit ?? 0,
      latestMonthName: lastFull?.name ?? '',
    };
  }, [expenses, profitSeries]);

  // Format the last updated time
  const getLastUpdatedText = () => {
    if (!lastUpdated) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return lastUpdated.toLocaleDateString();
  };

  if (isLoading) {
    console.log("Overview section is loading...");
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 gap-4">
        <Quantum size="100" speed="1.75" color="white" />
        <p className="text-spaceText">Loading dashboard data...</p>
      </div>
    );
  }

  console.log("Overview section loaded with data:", dashboardData);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="virtara-display text-3xl font-bold text-spaceText">
            Business Overview
          </h2>
          <p className="text-spaceAlt mt-1">Real-time insights into your business performance</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-spaceAlt">
            Last updated: {getLastUpdatedText()}
          </p>
          <Button 
            onClick={refreshData}
            variant="outline" 
            size="sm"
            className="border-spaceAccent text-spaceAccent hover:bg-spaceAccent hover:text-space1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
        <CardHeader>
          <CardTitle className="text-spaceText">Quick Actions</CardTitle>
          <CardDescription className="text-spaceAlt">
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2 border-spaceAccent/50 text-spaceAccent hover:bg-spaceAccent hover:text-space1"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">New Project</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2 border-spaceAccent/50 text-spaceAccent hover:bg-spaceAccent hover:text-space1"
            >
              <FileText className="h-6 w-6" />
              <span className="text-sm">Generate Quote</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2 border-spaceAccent/50 text-spaceAccent hover:bg-spaceAccent hover:text-space1"
            >
              <Mail className="h-6 w-6" />
              <span className="text-sm">Send Invoice</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2 border-spaceAccent/50 text-spaceAccent hover:bg-spaceAccent hover:text-space1"
            >
              <Download className="h-6 w-6" />
              <span className="text-sm">Export Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue Card */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Total Revenue</CardTitle>
            <div className="p-2 bg-spaceAccent/20 rounded-lg">
              <DollarSign className="h-4 w-4 text-spaceAccent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-spaceText">
              {formatZAR(enhancedData.totalRevenue)}
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className={`h-4 w-4 mr-1 ${enhancedData.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              <span className={`text-sm ${enhancedData.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {enhancedData.revenueGrowth >= 0 ? '+' : ''}{enhancedData.revenueGrowth.toFixed(1)}% this month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Active Projects Card */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Active Projects</CardTitle>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-spaceText">{enhancedData.activeProjects}</div>
            <div className="flex items-center mt-2">
              <Target className="h-4 w-4 mr-1 text-blue-400" />
              <span className="text-sm text-spaceAlt">
                {enhancedData.completedProjects} completed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Growth Card */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Customer Growth</CardTitle>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="h-4 w-4 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-spaceText">{enhancedData.totalCustomers}</div>
            <div className="flex items-center mt-2">
              <Zap className="h-4 w-4 mr-1 text-green-400" />
              <span className="text-sm text-spaceAlt">
                +{enhancedData.newCustomersThisMonth} this month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate Card */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Conversion Rate</CardTitle>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ArrowUpRight className="h-4 w-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-spaceText">{enhancedData.conversionRate}%</div>
            <div className="mt-2">
              <Progress value={enhancedData.conversionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Spent This Month */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Spent This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-spaceText">
              {formatZAR(expenseSummary.spentThisMonth)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Money out the door</p>
          </CardContent>
        </Card>

        {/* Fixed Monthly Burn */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Fixed Burn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-spaceAccent">
              {formatZAR(expenseSummary.fixedMonthlyBurn)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Recurring, per month</p>
          </CardContent>
        </Card>

        {/* Outstanding Invoices */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-400">
              {formatZAR(enhancedData.outstandingInvoices)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Requires attention</p>
          </CardContent>
        </Card>

        {/* Maintenance Revenue */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-400">
              {formatZAR(enhancedData.maintenanceRevenue)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Recurring income</p>
          </CardContent>
        </Card>

        {/* Pending Quotes */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Pending Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-400">
              {enhancedData.pendingQuotes}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Awaiting response</p>
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-400">
              {enhancedData.overdueInvoices}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Past 30 days</p>
          </CardContent>
        </Card>

        {/* Average Project Value */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Avg Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-spaceAccent">
              {formatZAR(enhancedData.avgProjectValue)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Per completed project</p>
          </CardContent>
        </Card>

        {/* Average Customer Value */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-spaceText/80">Avg Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-400">
              {formatZAR(enhancedData.avgCustomerValue)}
            </div>
            <p className="text-xs text-spaceAlt mt-1">Lifetime value</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Insights Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-4 bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-spaceText">Money In vs Money Out</CardTitle>
            <CardDescription className="text-spaceAlt">
              {expenses.length > 0
                ? `Revenue against recorded expenses over the last 6 months — ${expenseSummary.latestMonthName} cleared ${formatZAR(expenseSummary.latestProfit)}`
                : 'Revenue over the last 6 months. Record expenses to see profit here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profitSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(141,246,255,0.10)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6fc2ff"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6fc2ff"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(value) => `R${Number(value).toLocaleString('en-ZA')}`}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(141,246,255,0.25)' }}
                  formatter={(value, name) => [formatZAR(Number(value ?? 0)), String(name ?? '')]}
                  contentStyle={{
                    backgroundColor: '#060a11',
                    border: '1px solid rgba(141,246,255,0.35)',
                    borderRadius: '12px',
                    color: '#edf4ff',
                  }}
                  labelStyle={{ color: '#6fc2ff' }}
                />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, color: '#edf4ff', paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#8df6ff"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#f87171"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#4ade80"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Status Breakdown */}
        <Card className="col-span-3 bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-spaceText">Project Status</CardTitle>
            <CardDescription className="text-spaceAlt">
              Distribution of projects by status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enhancedData.projectStatusBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={enhancedData.projectStatusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {enhancedData.projectStatusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#060a11',
                        border: '1px solid rgba(141,246,255,0.35)',
                        borderRadius: '12px',
                        color: '#edf4ff'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {enhancedData.projectStatusBreakdown.map((status, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm text-spaceText">{status.name}</span>
                      <span className="text-sm text-spaceAlt ml-auto">{status.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-spaceAlt">
                <p>No project data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performing Customers */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-spaceText">Top Performing Customers</CardTitle>
            <CardDescription className="text-spaceAlt">
              Customers with highest lifetime value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {enhancedData.topPerformingCustomers.length > 0 ? (
                enhancedData.topPerformingCustomers.map((customer, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-spaceAccent/20 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-spaceAccent/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-spaceAccent">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-spaceText">{customer.name}</p>
                        <p className="text-xs text-spaceAlt">{customer.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-spaceText">
                        {formatZAR(customer.totalSpent)}
                      </p>
                      <p className="text-xs text-spaceAlt">{customer.projects} projects</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-[200px] text-spaceAlt">
                  <p>No customer data available</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-linear-to-br from-space2 to-space1 border-spaceAccent/50 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-spaceText">Recent Activity</CardTitle>
            <CardDescription className="text-spaceAlt">
              Latest quotes and project updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {enhancedData.recentActivity.length > 0 ? (
                enhancedData.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 py-3 border-b border-spaceAccent/20 last:border-0">
                    <div className={`p-2 rounded-full ${
                      activity.status === 'accepted' ? 'bg-green-500/20' : 
                      activity.status === 'pending' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                    }`}>
                      {activity.status === 'accepted' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : activity.status === 'pending' ? (
                        <Clock className="h-4 w-4 text-yellow-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-spaceText">{activity.title}</p>
                      <p className="text-xs text-spaceAlt">{activity.description}</p>
                      <p className="text-xs text-spaceAlt mt-1">
                        {activity.date.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge 
                      variant={activity.status === 'accepted' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-[200px] text-spaceAlt">
                  <p>No recent activity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
