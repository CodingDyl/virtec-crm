'use client'

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFollowUps } from '@/contexts/DataContexts';
import { FollowUp } from '@/types/follow-up';
import { RefreshCw, Wand2 } from 'lucide-react';
import { FollowUpBucket, FollowUpFilters, FollowUpTypeFilter } from './FollowUpFilters';
import { FollowUpItem } from './FollowUpItem';

function matchesSearch(followUp: FollowUp, search: string): boolean {
  if (!search.trim()) return true;
  const haystack = [
    followUp.customerName,
    followUp.companyName,
    followUp.projectName,
    followUp.reason,
    followUp.customerEmail,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

export default function FollowUpsSection() {
  const {
    dueTodayFollowUps,
    overdueFollowUps,
    upcomingFollowUps,
    doneFollowUps,
    isLoading,
    lastUpdated,
  } = useFollowUps();
  const [bucket, setBucket] = useState<FollowUpBucket>('today');
  const [type, setType] = useState<FollowUpTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const counts = {
    today: dueTodayFollowUps.length,
    overdue: overdueFollowUps.length,
    upcoming: upcomingFollowUps.length,
    done: doneFollowUps.length,
  };

  const rows = useMemo(() => {
    const source = {
      today: dueTodayFollowUps,
      overdue: overdueFollowUps,
      upcoming: upcomingFollowUps,
      done: doneFollowUps,
    }[bucket];

    return source.filter((followUp) => {
      const typeMatches = type === 'all' || followUp.type === type;
      return typeMatches && matchesSearch(followUp, search);
    });
  }, [bucket, dueTodayFollowUps, doneFollowUps, overdueFollowUps, search, type, upcomingFollowUps]);

  const generate = async () => {
    setGenerating(true);
    setSummary(null);
    try {
      const response = await fetch('/api/follow-ups/generate', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Generation failed');
      const message = `Created ${result.created ?? 0}, skipped ${result.skipped ?? 0}.`;
      setSummary(message);
      toast.success(message);
    } catch (error) {
      console.error('follow-up generation failed:', error);
      toast.error('Could not generate follow-ups.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="virtara-display text-2xl text-spaceText">Follow-ups</h2>
          <p className="mt-1 text-sm text-spaceAlt/85">
            Operator queue for money, signatures, renewals, and stalled work.
          </p>
          <p className="mt-1 text-xs text-spaceAlt/65">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {generating ? 'Generating...' : 'Generate follow-ups'}
        </Button>
      </div>

      {summary && (
        <p className="rounded-lg border border-spaceAccent/25 bg-space1/50 px-3 py-2 text-sm text-spaceAlt">
          {summary}
        </p>
      )}

      <FollowUpFilters
        bucket={bucket}
        onBucketChange={setBucket}
        type={type}
        onTypeChange={setType}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
      />

      {isLoading ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-6 text-sm text-spaceAlt">Loading follow-ups...</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-8 text-center">
            <p className="text-sm font-semibold text-spaceText">No follow-ups in this view</p>
            <p className="mt-1 text-sm text-spaceAlt/80">
              Generate the queue or adjust the filters to see other items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((followUp) => (
            <FollowUpItem key={followUp.id} followUp={followUp} />
          ))}
        </div>
      )}
    </section>
  );
}
