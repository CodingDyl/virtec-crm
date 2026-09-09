'use client'

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, MapPin, RefreshCw, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocalLeads } from '@/contexts/DataContexts';
import { toDate } from '@/lib/firestore-schema';
import {
  LocalLead,
  LocalLeadScoreBand,
  LocalLeadStatus,
  LocalLeadTrack,
  LOCAL_LEAD_STATUSES,
  LOCAL_LEAD_TRACKS,
} from '@/types/local-lead';

const SCORE_BANDS: { value: LocalLeadScoreBand; label: string }[] = [
  { value: 'all', label: 'All scores' },
  { value: 'hot', label: 'Hot (≥70)' },
  { value: 'warm', label: 'Warm (40–69)' },
  { value: 'cold', label: 'Cold (<40)' },
];

const WEBSITE_SIGNAL_LABEL: Record<LocalLead['websiteSignal'], string> = {
  none: 'None',
  facebook_only: 'Facebook only',
  weak: 'Weak',
  ok: 'OK',
  unknown: 'Unknown',
};

const selectClass =
  'h-9 rounded-md border border-spaceAccent bg-space1 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent';

function scoreBandOf(score: number): Exclude<LocalLeadScoreBand, 'all'> {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (score >= 40) return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
  return 'border-slate-400/40 bg-slate-500/15 text-slate-200';
}

function mapsUrl(lead: LocalLead): string | null {
  if (typeof lead.lat === 'number' && typeof lead.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`;
  }
  if (lead.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address.trim())}`;
  }
  return null;
}

function formatSeen(value: any): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LocalLeadsSection() {
  const { localLeads, isLoading, lastUpdated, updateLeadStatus } = useLocalLeads();
  const [area, setArea] = useState('all');
  const [category, setCategory] = useState('all');
  const [scoreBand, setScoreBand] = useState<LocalLeadScoreBand>('all');
  const [status, setStatus] = useState<LocalLeadStatus | 'all'>('all');
  const [track, setTrack] = useState<LocalLeadTrack | 'all'>('all');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    localLeads.forEach((lead) => {
      if (lead.area?.trim()) set.add(lead.area.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localLeads]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    localLeads.forEach((lead) => {
      if (lead.category?.trim()) set.add(lead.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localLeads]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localLeads.filter((lead) => {
      if (area !== 'all' && lead.area !== area) return false;
      if (category !== 'all' && lead.category !== category) return false;
      if (status !== 'all' && lead.status !== status) return false;
      if (track !== 'all' && lead.track !== track) return false;
      if (scoreBand !== 'all' && scoreBandOf(lead.score) !== scoreBand) return false;
      if (!q) return true;
      const haystack = [
        lead.name,
        lead.category,
        lead.area,
        lead.suburb,
        lead.address,
        lead.phone,
        lead.websiteUrl,
        lead.source,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [area, category, localLeads, scoreBand, search, status, track]);

  const runScan = async () => {
    setScanning(true);
    try {
      const body = {
        track: (track === 'all' ? 'all' : track) as 'virtara' | 'jurivo' | 'all',
        radiusMeters: 8000,
      };

      const response = await fetch('/api/local-leads/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        toast.error(result.error ?? 'Not authorised. Sign in again.');
        return;
      }
      if (response.status === 503) {
        toast.error(result.error ?? 'GOOGLE_PLACES_API_KEY is not configured');
        return;
      }
      if (!response.ok) {
        toast.error(result.error ?? 'Scan failed');
        return;
      }

      const fetched = result.fetched ?? 0;
      const upserted = result.upserted ?? 0;
      const skipped = result.skipped ?? 0;
      toast.success(
        result.message ||
          `Scan complete: fetched ${fetched}, upserted ${upserted}, skipped ${skipped}`
      );
    } catch (error) {
      console.error('local-leads scan failed:', error);
      toast.error('Could not reach scan endpoint.');
    } finally {
      setScanning(false);
    }
  };

  const onStatusChange = async (lead: LocalLead, next: LocalLeadStatus) => {
    if (!lead.id || lead.status === next) return;
    setBusyId(lead.id);
    try {
      await updateLeadStatus(lead.id, next);
      toast.success(`Status → ${next}`);
    } catch (error) {
      console.error('status update failed:', error);
      toast.error('Could not update status.');
    } finally {
      setBusyId(null);
    }
  };

  const onConvert = async (lead: LocalLead) => {
    if (!lead.id) return;
    setBusyId(lead.id);
    try {
      const extra = lead.customerId ? { customerId: lead.customerId } : undefined;
      await updateLeadStatus(lead.id, 'converted', extra);
      toast.success(
        lead.customerId
          ? `Converted (linked customer ${lead.customerId})`
          : 'Marked converted (no customer link yet)'
      );
    } catch (error) {
      console.error('convert failed:', error);
      toast.error('Could not convert lead.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="virtara-display text-2xl text-spaceText">Local leads</h2>
          <p className="mt-1 text-sm text-spaceAlt/85">
            Sandton / local Places pipeline. Review, score-band filter, convert — no outreach send from here.
          </p>
          <p className="mt-1 text-xs text-spaceAlt/65">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'} · Showing {rows.length} of {localLeads.length}
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning}>
          {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {scanning ? 'Scanning...' : 'Scan'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, area, phone..."
          className="h-9 min-w-0 border-spaceAccent bg-space1 text-spaceText sm:w-64"
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
          <option value="all">All areas</option>
          {areaOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="all">All categories</option>
          {categoryOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select
          value={scoreBand}
          onChange={(e) => setScoreBand(e.target.value as LocalLeadScoreBand)}
          className={selectClass}
        >
          {SCORE_BANDS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LocalLeadStatus | 'all')}
          className={selectClass}
        >
          <option value="all">All statuses</option>
          {LOCAL_LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as LocalLeadTrack | 'all')}
          className={selectClass}
        >
          <option value="all">All tracks</option>
          {LOCAL_LEAD_TRACKS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-6 text-sm text-spaceAlt">Loading local leads...</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-8 text-center">
            <p className="text-sm font-semibold text-spaceText">No local leads in this view</p>
            <p className="mt-1 text-xs text-spaceAlt/80">
              Adjust filters or run Scan once Places ingest is configured.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-spaceAccent/25 bg-space1/55">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-spaceAccent/20 hover:bg-transparent">
                  <TableHead className="text-spaceAlt">Business</TableHead>
                  <TableHead className="text-spaceAlt">Category</TableHead>
                  <TableHead className="text-spaceAlt">Area</TableHead>
                  <TableHead className="text-spaceAlt">Website signal</TableHead>
                  <TableHead className="text-spaceAlt">Score</TableHead>
                  <TableHead className="text-spaceAlt">Status</TableHead>
                  <TableHead className="text-spaceAlt">Source</TableHead>
                  <TableHead className="text-spaceAlt">Last seen</TableHead>
                  <TableHead className="text-spaceAlt">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lead) => {
                  const mapHref = mapsUrl(lead);
                  const busy = busyId === lead.id;
                  return (
                    <TableRow key={lead.id ?? lead.googlePlaceId} className="border-spaceAccent/15">
                      <TableCell className="max-w-[220px]">
                        <div className="font-medium text-spaceText">{lead.name}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-spaceAlt/80">
                          {lead.websiteUrl ? (
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-spaceAccent hover:underline"
                            >
                              Website <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {mapHref ? (
                            <a
                              href={mapHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-spaceAccent hover:underline"
                            >
                              Maps <MapPin className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                        {lead.scoreReasons?.length ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-spaceAlt/60">
                            {lead.scoreReasons.join(' · ')}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-spaceAlt">{lead.category || '—'}</TableCell>
                      <TableCell className="text-sm text-spaceAlt">
                        <div>{lead.area || '—'}</div>
                        {lead.suburb ? <div className="text-xs text-spaceAlt/60">{lead.suburb}</div> : null}
                      </TableCell>
                      <TableCell className="text-sm text-spaceAlt">
                        {WEBSITE_SIGNAL_LABEL[lead.websiteSignal] ?? lead.websiteSignal}
                      </TableCell>
                      <TableCell>
                        <Badge className={scoreBadgeClass(lead.score)}>{lead.score}</Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          value={lead.status}
                          disabled={busy || !lead.id}
                          onChange={(e) => onStatusChange(lead, e.target.value as LocalLeadStatus)}
                          className={selectClass}
                        >
                          {LOCAL_LEAD_STATUSES.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-sm text-spaceAlt">
                        <div>{lead.source || '—'}</div>
                        <div className="text-xs text-spaceAlt/60">{lead.track}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-spaceAlt">
                        {formatSeen(lead.lastFetchedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || !lead.id || lead.status === 'converted'}
                          onClick={() => onConvert(lead)}
                          className="border-spaceAccent/40"
                        >
                          Convert
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </section>
  );
}
