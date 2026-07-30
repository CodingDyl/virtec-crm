'use client'

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FollowUpType } from '@/types/follow-up';

export type FollowUpBucket = 'today' | 'overdue' | 'upcoming' | 'done';
export type FollowUpTypeFilter = 'all' | FollowUpType;

interface FollowUpFiltersProps {
  bucket: FollowUpBucket;
  onBucketChange: (bucket: FollowUpBucket) => void;
  type: FollowUpTypeFilter;
  onTypeChange: (type: FollowUpTypeFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  counts: Record<FollowUpBucket, number>;
}

const typeOptions: { value: FollowUpTypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'invoice_overdue', label: 'Invoices' },
  { value: 'quote_pending', label: 'Quotes' },
  { value: 'agreement_pending', label: 'Agreements' },
  { value: 'maintenance_renewal', label: 'Renewals' },
  { value: 'project_stale', label: 'Stale projects' },
];

export function FollowUpFilters({
  bucket,
  onBucketChange,
  type,
  onTypeChange,
  search,
  onSearchChange,
  counts,
}: FollowUpFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs value={bucket} onValueChange={(value) => onBucketChange(value as FollowUpBucket)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap bg-space2/70 text-spaceText lg:w-auto">
          <TabsTrigger value="today">Due Today ({counts.today})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({counts.overdue})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({counts.upcoming})</TabsTrigger>
          <TabsTrigger value="done">Done ({counts.done})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search customer, company, project"
          className="h-9 min-w-0 border-spaceAccent bg-space1 text-spaceText sm:w-72"
        />
        <select
          value={type}
          onChange={(event) => onTypeChange(event.target.value as FollowUpTypeFilter)}
          className="h-9 rounded-md border border-spaceAccent bg-space1 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
