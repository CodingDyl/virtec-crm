'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Mail, Phone } from 'lucide-react';
import { db } from '@/firebase/firebaseConfig';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthUid } from '@/hooks/use-auth-uid';
import { toDate } from '@/lib/firestore-schema';
import {
  INBOUND_LEADS_COLLECTION,
  INBOUND_LEAD_STATUSES,
  type InboundLead,
  type InboundLeadStatus,
  type InboundLeadTrack,
} from '@/types/inbound-lead';

const STATUS_LABEL: Record<InboundLeadStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  replied: 'Replied',
  won: 'Won',
  not_a_fit: 'Not a fit',
  spam: 'Spam',
};

const selectClass =
  'h-9 rounded-md border border-spaceAccent bg-space1 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent';

function formatWhen(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'Just now';
  return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Leads from the Virtara and Jurivo websites.
 *
 * They are created only by `/api/inbound/leads` (the rules refuse a browser
 * create); here they are read, triaged and, for spam, deleted.
 */
export default function WebsiteLeadsSection() {
  const uid = useAuthUid();
  const [leads, setLeads] = useState<InboundLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [track, setTrack] = useState<InboundLeadTrack | 'all'>('all');
  const [status, setStatus] = useState<InboundLeadStatus | 'open'>('open');

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, INBOUND_LEADS_COLLECTION), orderBy('createdAt', 'desc'), limit(300)),
      (snapshot) => {
        setLeads(snapshot.docs.map((item) => ({ id: item.id, details: {}, ...item.data() }) as InboundLead));
        setIsLoading(false);
      },
      (error) => {
        console.error('inbound_leads snapshot error', error);
        setIsLoading(false);
      },
    );
  }, [uid]);

  const rows = useMemo(
    () =>
      leads.filter((lead) => {
        if (track !== 'all' && lead.track !== track) return false;
        if (status === 'open') return lead.status === 'new' || lead.status === 'reviewing';
        return lead.status === status;
      }),
    [leads, status, track],
  );

  const setLeadStatus = async (id: string, next: InboundLeadStatus) => {
    try {
      await updateDoc(doc(db, INBOUND_LEADS_COLLECTION, id), { status: next, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error(error);
      toast.error('Could not update the lead');
    }
  };

  return (
    <section className="space-y-4" aria-label="Website leads">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Site" className={selectClass} value={track} onChange={(event) => setTrack(event.target.value as InboundLeadTrack | 'all')}>
          <option value="all">Both sites</option>
          <option value="virtara">Virtara</option>
          <option value="jurivo">Jurivo</option>
        </select>
        <select aria-label="Status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as InboundLeadStatus | 'open')}>
          <option value="open">Open (new, reviewing)</option>
          {INBOUND_LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <span className="text-xs text-spaceAlt/80">{rows.length} shown</span>
      </div>

      {isLoading ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-6 text-sm text-spaceAlt">Loading website leads...</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-spaceAccent/25 bg-space1/55">
          <CardContent className="p-6 text-sm text-spaceAlt">No website leads here yet.</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((lead) => (
            <li key={lead.id}>
              <Card className="h-full border-spaceAccent/25 bg-space1/55">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-spaceText">{lead.name}</h3>
                      <p className="text-xs text-spaceAlt/85">
                        {lead.company ? `${lead.company} · ` : ''}
                        {formatWhen(lead.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="capitalize">{lead.track}</Badge>
                      <Badge variant="outline">{lead.source}</Badge>
                      {lead.nurtureSentAt ? <Badge variant="outline">Guide emailed</Badge> : null}
                      {lead.nurtureError ? (
                        <Badge variant="outline" title={lead.nurtureError} className="border-amber-400/40 text-amber-100">
                          Email not sent
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a className="inline-flex items-center gap-1 text-spaceAccent hover:underline" href={`mailto:${lead.email}`}>
                      <Mail className="size-3.5" aria-hidden="true" />
                      {lead.email}
                    </a>
                    {lead.phone ? (
                      <a className="inline-flex items-center gap-1 text-spaceAccent hover:underline" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
                        <Phone className="size-3.5" aria-hidden="true" />
                        {lead.phone}
                      </a>
                    ) : null}
                    {lead.website ? (
                      <a className="text-spaceAccent hover:underline" href={lead.website} target="_blank" rel="noopener noreferrer nofollow">
                        {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    ) : null}
                  </div>

                  {Object.keys(lead.details ?? {}).length > 0 ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      {Object.entries(lead.details).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-spaceAlt/75">{key}</dt>
                          <dd className="text-spaceText">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {lead.message ? <p className="whitespace-pre-wrap text-sm text-spaceText/90">{lead.message}</p> : null}

                  <label className="flex items-center gap-2 text-xs text-spaceAlt">
                    Status
                    <select
                      className={selectClass}
                      value={lead.status}
                      onChange={(event) => void setLeadStatus(lead.id, event.target.value as InboundLeadStatus)}
                    >
                      {INBOUND_LEAD_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
