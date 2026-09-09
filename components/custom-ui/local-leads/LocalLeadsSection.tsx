'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { Radar, RefreshCw } from 'lucide-react';
import { db } from '@/firebase/firebaseConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LocalLead, LocalLeadTrack } from '@/types/local-lead';

type TrackFilter = LocalLeadTrack | 'all';

export default function LocalLeadsSection() {
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [track, setTrack] = useState<TrackFilter>('all');
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'localLeads'),
      orderBy('score', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as LocalLead) })));
        setLoading(false);
      },
      (err) => {
        console.error('localLeads snapshot failed', err);
        toast.error('Could not load local leads.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (track === 'all') return leads;
    return leads.filter((l) => l.track === track);
  }, [leads, track]);

  const scan = async () => {
    setScanning(true);
    setLastSummary(null);
    try {
      const response = await fetch('/api/local-leads/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 503) {
        toast.error(result.error ?? 'GOOGLE_PLACES_API_KEY is not configured');
        return;
      }
      if (!response.ok) {
        throw new Error(result.error ?? 'Scan failed');
      }
      const message = `Fetched ${result.fetched ?? 0}, upserted ${result.upserted ?? 0}, skipped ${result.skipped ?? 0}.`;
      setLastSummary(message);
      toast.success(message);
    } catch (error: any) {
      console.error('local-leads scan failed', error);
      toast.error(error?.message || 'Could not run Sandton scan.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-spaceText">Local leads</h2>
          <p className="text-sm text-spaceAlt/90">
            Places ingest for Virtara / Jurivo. Desk owns further FE polish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-spaceAccent/30 bg-space2 px-3 py-2 text-sm text-spaceText"
            value={track}
            onChange={(e) => setTrack(e.target.value as TrackFilter)}
            aria-label="Track filter"
          >
            <option value="all">All tracks</option>
            <option value="virtara">Virtara</option>
            <option value="jurivo">Jurivo</option>
          </select>
          <Button onClick={scan} disabled={scanning} className="gap-2">
            {scanning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Radar className="h-4 w-4" />
            )}
            Scan Sandton
          </Button>
        </div>
      </div>

      {lastSummary && <p className="text-sm text-spaceAlt">{lastSummary}</p>}

      <Card className="border-spaceAccent/20 bg-space2/40">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-spaceAlt">Loading leads…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-spaceAlt">
              No local leads yet. Set GOOGLE_PLACES_API_KEY then Scan Sandton.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-spaceAccent/20 text-spaceAlt">
                  <tr>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Signal</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr
                      key={lead.googlePlaceId}
                      className="border-b border-spaceAccent/10 text-spaceText"
                    >
                      <td className="px-4 py-3 font-semibold">{lead.score}</td>
                      <td className="px-4 py-3">
                        <div>{lead.name}</div>
                        <div className="text-xs text-spaceAlt">{lead.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{lead.category}</div>
                        <div className="text-xs uppercase text-spaceAlt">{lead.track}</div>
                      </td>
                      <td className="px-4 py-3">{lead.websiteSignal}</td>
                      <td className="px-4 py-3">{lead.status}</td>
                      <td className="px-4 py-3">{lead.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
