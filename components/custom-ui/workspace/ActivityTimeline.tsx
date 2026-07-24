'use client'

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { ActivityEntry } from '@/lib/activity';
import { toDate } from '@/lib/firestore-schema';
import { formatDistanceToNow } from 'date-fns';
import { Clock } from 'lucide-react';

interface ActivityTimelineProps {
  projectId: string;
}

export function ActivityTimeline({ projectId }: ActivityTimelineProps) {
  const [items, setItems] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    // No orderBy in the query (avoids a composite index) — we sort client-side.
    const unsub = onSnapshot(
      query(collection(db, 'activity'), where('refId', '==', projectId)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as ActivityEntry[];
        rows.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
        setItems(rows.slice(0, 20));
      },
      (err) => console.error('activity snapshot error', err)
    );
    return unsub;
  }, [projectId]);

  if (items.length === 0) {
    return <p className="text-sm text-spaceAlt/60">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const when = toDate(item.createdAt);
        return (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-spaceAccent" />
            <div className="min-w-0">
              <p className="text-spaceText">{item.message}</p>
              <p className="text-xs text-spaceAlt/60">
                {when ? formatDistanceToNow(when, { addSuffix: true }) : 'just now'}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
