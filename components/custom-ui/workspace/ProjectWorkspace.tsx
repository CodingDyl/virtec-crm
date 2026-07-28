'use client'

import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { OverviewTab } from './OverviewTab';
import { DocumentsTab } from './DocumentsTab';
import { QuotesTab } from './QuotesTab';
import { DesignTab } from './DesignTab';
import { TasksTab } from './TasksTab';
import { Trash2 } from 'lucide-react';

export type WorkspaceTab = 'overview' | 'quotes' | 'documents' | 'design' | 'tasks';

interface ProjectWorkspaceProps {
  project: Project | null;
  customers: Customer[];
  activeTab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  onDeleteProject: () => void;
}

const TABS: { key: WorkspaceTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'documents', label: 'Documents' },
  { key: 'design', label: 'Design' },
  { key: 'tasks', label: 'Tasks' },
];

export function ProjectWorkspace({ project, customers, activeTab, onTabChange, onDeleteProject }: ProjectWorkspaceProps) {
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
        Select a project to open its workspace.
      </div>
    );
  }

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
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === activeTab}
            onClick={() => onTabChange(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              t.key === activeTab
                ? 'bg-spaceAccent text-space1 font-medium'
                : 'text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === 'overview' && <OverviewTab project={project} customers={customers} />}
        {activeTab === 'quotes' && <QuotesTab project={project} />}
        {activeTab === 'documents' && <DocumentsTab project={project} />}
        {activeTab === 'design' && <DesignTab project={project} />}
        {activeTab === 'tasks' && <TasksTab project={project} />}
      </div>
    </div>
  );
}
