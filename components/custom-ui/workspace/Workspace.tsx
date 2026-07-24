'use client'

import { useEffect, useMemo, useState } from 'react';
import { useCustomers, useProjects, useQuotes } from '@/contexts/DataContexts';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { CustomerPane } from './CustomerPane';
import { CustomerHeader } from './CustomerHeader';
import { ProjectPane } from './ProjectPane';
import { ProjectWorkspace, WorkspaceTab } from './ProjectWorkspace';

export default function Workspace() {
  const { customers, isLoading: customersLoading, refreshData: refreshCustomers } = useCustomers();
  const { projects, refreshData: refreshProjects } = useProjects();
  const { quotes } = useQuotes();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const customerProjects = useMemo(
    () => (selectedCustomerId ? projects.filter((p) => p.clientId === selectedCustomerId) : []),
    [projects, selectedCustomerId]
  );

  const selectedProject = useMemo(
    () => customerProjects.find((p) => p.id === selectedProjectId) ?? null,
    [customerProjects, selectedProjectId]
  );

  // Pending quotes for this customer's projects.
  const outstandingQuoteCount = useMemo(() => {
    const ids = new Set(customerProjects.map((p) => p.id));
    return quotes.filter((q) => {
      const pid = (q as any).projectId ?? (q as any).project_id;
      return ids.has(pid) && q.status === 'pending';
    }).length;
  }, [quotes, customerProjects]);

  // Clear the project selection when switching customers.
  useEffect(() => {
    setSelectedProjectId(null);
    setActiveTab('overview');
  }, [selectedCustomerId]);

  if (customersLoading) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-4">
        <Quantum size="100" speed="1.75" color="white" />
        <p className="text-spaceText">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[260px_320px_1fr]">
      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <CustomerPane
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={setSelectedCustomerId}
          onRefresh={refreshCustomers}
        />
      </div>

      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <ProjectPane
          customer={selectedCustomer}
          projects={customerProjects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onRefresh={refreshProjects}
          header={
            selectedCustomer ? (
              <CustomerHeader
                customer={selectedCustomer}
                projectCount={customerProjects.length}
                activeCount={customerProjects.filter((p) => p.status === 'active').length}
                outstandingQuoteCount={outstandingQuoteCount}
              />
            ) : null
          }
        />
      </div>

      <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 p-4">
        <ProjectWorkspace
          project={selectedProject}
          customers={customers}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
