'use client'

import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { OverviewTab } from './OverviewTab';
import { DocumentsTab } from './DocumentsTab';
import { QuotesTab } from './QuotesTab';
import { DesignTab } from './DesignTab';
import { TasksTab } from './TasksTab';
import { ShareTab } from './ShareTab';
import { MaintenanceTab } from './MaintenanceTab';
import { isMaintenanceProject } from '@/lib/maintenance';
import { Trash2 } from 'lucide-react';

export type WorkspaceTab = 'overview' | 'maintenance' | 'quotes' | 'documents' | 'design' | 'tasks' | 'share';

interface ProjectWorkspaceProps {
  project: Project | null;
  customers: Customer[];
  activeTab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  onDeleteProject: () => void;
}

/** Maintenance billing only applies to maintenance projects, so its tab only appears there. */
function tabsFor(project: Project): { key: WorkspaceTab; label: string }[] {
  return [
    { key: 'overview' as const, label: 'Overview' },
    ...(isMaintenanceProject(project) ? [{ key: 'maintenance' as const, label: 'Maintenance' }] : []),
    { key: 'quotes' as const, label: 'Quotes' },
    { key: 'documents' as const, label: 'Documents' },
    { key: 'design' as const, label: 'Design' },
    { key: 'tasks' as const, label: 'Tasks' },
    { key: 'share' as const, label: 'Share' },
  ];
}

export function ProjectWorkspace({ project, customers, activeTab, onTabChange, onDeleteProject }: ProjectWorkspaceProps) {
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
        Select a project to open its workspace.
      </div>
    );
  }

  const tabs = tabsFor(project);
  // Switching from a maintenance project to a normal one can leave the selection
  // pointing at a tab that no longer exists — fall back rather than render blank.
  const currentTab = tabs.some((t) => t.key === activeTab) ? activeTab : 'overview';

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-spaceText">{project.projectType}</p>
          <p className="truncate text-sm text-spaceAlt/80">{project.clientName}</p>
        </div>
        <button
          type="button"
          onClick={onDeleteProject}
          aria-label={`Delete project ${project.projectType}`}
          title="Delete project"
          className="shrink-0 rounded-md p-1.5 text-spaceAlt/70 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div role="tablist" aria-label="Project sections" className="flex flex-wrap gap-1 border-b border-spaceAccent/20 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === currentTab}
            onClick={() => onTabChange(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              t.key === currentTab
                ? 'bg-spaceAccent text-space1 font-medium'
                : 'text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {currentTab === 'overview' && <OverviewTab project={project} customers={customers} />}
        {currentTab === 'maintenance' && <MaintenanceTab project={project} />}
        {currentTab === 'quotes' && <QuotesTab project={project} />}
        {currentTab === 'documents' && <DocumentsTab project={project} />}
        {currentTab === 'design' && <DesignTab project={project} />}
        {currentTab === 'tasks' && <TasksTab project={project} />}
        {currentTab === 'share' && <ShareTab project={project} />}
      </div>
    </div>
  );
}
