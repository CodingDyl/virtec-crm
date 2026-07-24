'use client'

import { Customer } from '@/types/customer';
import { Project } from '@/types/project';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddProjectModal } from "../add-project-modal";

interface ProjectPaneProps {
  customer: Customer | null;
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  header: React.ReactNode;
  onRefresh: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-blue-500';
    case 'on-hold': return 'bg-gray-500';
    case 'completed': return 'bg-green-500';
    default: return 'bg-blue-500';
  }
}

export function ProjectPane({ customer, projects, selectedProjectId, onSelect, header, onRefresh }: ProjectPaneProps) {
  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
        Select a customer to see their projects.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {header}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-spaceText">Projects</p>
        <AddProjectModal onProjectAdded={onRefresh} />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {projects.length === 0 ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">No projects for this customer yet.</p>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={p.id === selectedProjectId}
              onClick={() => onSelect(p.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                p.id === selectedProjectId
                  ? 'border-spaceAccent bg-spaceAccent/15'
                  : 'border-spaceAccent/25 hover:bg-space1/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-spaceText">{p.projectType}</span>
                <Badge className={`text-white capitalize ${statusColor(p.status)}`}>{p.status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={p.completion} className="h-1.5 bg-space1" />
                <span className="text-xs text-spaceAlt/80">{p.completion}%</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
