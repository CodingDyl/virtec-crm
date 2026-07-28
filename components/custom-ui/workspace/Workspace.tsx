'use client'

import { useEffect, useMemo, useState } from 'react';
import { useCustomers, useMaintenanceInvoices, useProjects, useQuotes } from '@/contexts/DataContexts';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { toast } from 'sonner';
import { CustomerPane } from './CustomerPane';
import { CustomerHeader } from './CustomerHeader';
import { ProjectPane } from './ProjectPane';
import { ProjectWorkspace, WorkspaceTab } from './ProjectWorkspace';
import { DeleteEntityDialog } from '../delete-entity-dialog';
import { EditCustomerModal } from '../edit-customer-modal';
import {
  deleteCustomerCascade,
  deleteProjectCascade,
  getCustomerDeletionImpact,
  getProjectDeletionImpact,
} from '@/lib/cascade-delete';
import {
  frequencyLabel,
  isMaintenanceProject,
  summariseMaintenance,
} from '@/lib/maintenance';

export default function Workspace() {
  const { customers, isLoading: customersLoading, refreshData: refreshCustomers } = useCustomers();
  const { projects, refreshData: refreshProjects } = useProjects();
  const { quotes } = useQuotes();
  const { invoices: maintenanceInvoices } = useMaintenanceInvoices();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

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

  /**
   * What this customer has paid in maintenance, lifetime. Counted from every
   * invoice raised against them — including any not yet attached to a project —
   * so the figure matches what they were actually billed.
   */
  const customerMaintenance = useMemo(() => {
    if (!selectedCustomerId) return null;

    const maintenanceProjects = customerProjects.filter(isMaintenanceProject);
    const theirInvoices = maintenanceInvoices.filter((i) => i.clientId === selectedCustomerId);
    if (maintenanceProjects.length === 0 && theirInvoices.length === 0) return null;

    const cadences = new Set(
      maintenanceProjects.map((p) => p.maintenanceFrequency).filter(Boolean)
    );
    const { totalPaid, outstanding } = summariseMaintenance(theirInvoices);

    return {
      totalPaid,
      outstanding,
      cadence:
        cadences.size === 1 ? frequencyLabel([...cadences][0]) : cadences.size > 1 ? 'Mixed' : null,
    };
  }, [customerProjects, maintenanceInvoices, selectedCustomerId]);

  // Clear the project selection when switching customers.
  useEffect(() => {
    setSelectedProjectId(null);
    setActiveTab('overview');
  }, [selectedCustomerId]);

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?.id) return;
    const name = selectedCustomer.companyName || selectedCustomer.name;
    try {
      await deleteCustomerCascade(selectedCustomer.id);
      // Drop the selection before the snapshot arrives so no pane renders a ghost.
      setSelectedProjectId(null);
      setSelectedCustomerId(null);
      toast.success(`${name} deleted.`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Could not delete the customer. Nothing was removed.');
      throw error;
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const name = selectedProject.projectType;
    try {
      await deleteProjectCascade(selectedProject.id, selectedProject.agreementUrl);
      setSelectedProjectId(null);
      setActiveTab('overview');
      toast.success(`${name} deleted.`);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Could not delete the project. Nothing was removed.');
      throw error;
    }
  };

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
                maintenance={customerMaintenance}
                onEdit={() => setEditingCustomer(true)}
                onDelete={() => setDeletingCustomer(true)}
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
          onDeleteProject={() => setDeletingProject(true)}
        />
      </div>

      {selectedCustomer?.id && (
        <EditCustomerModal
          customer={selectedCustomer}
          open={editingCustomer}
          onOpenChange={setEditingCustomer}
          onSaved={refreshCustomers}
        />
      )}

      {selectedCustomer?.id && (
        <DeleteEntityDialog
          open={deletingCustomer}
          onOpenChange={setDeletingCustomer}
          entityLabel="customer"
          entityName={selectedCustomer.companyName || selectedCustomer.name}
          loadImpact={() => getCustomerDeletionImpact(selectedCustomer.id!)}
          onConfirm={handleDeleteCustomer}
        />
      )}

      {selectedProject && (
        <DeleteEntityDialog
          open={deletingProject}
          onOpenChange={setDeletingProject}
          entityLabel="project"
          entityName={selectedProject.projectType}
          loadImpact={() => getProjectDeletionImpact(selectedProject.id, selectedProject.agreementUrl)}
          onConfirm={handleDeleteProject}
        />
      )}
    </div>
  );
}
