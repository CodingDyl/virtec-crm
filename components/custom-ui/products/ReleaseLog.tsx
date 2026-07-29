'use client'

import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, where,
} from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { ProductRelease } from '@/types/product';
import { toDate } from '@/lib/firestore-schema';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "../confirm-dialog";
import { toast } from 'sonner';
import { Plus, Trash2, Tag } from 'lucide-react';

interface ReleaseLogProps {
  productId: string;
  onReleasesChange?: (releases: ProductRelease[]) => void;
}

const toInputDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

/**
 * What shipped, and when. Doubles as the answer to "what did I actually get
 * done last quarter?", which is otherwise surprisingly hard to reconstruct.
 */
export function ReleaseLog({ productId, onReleasesChange }: ReleaseLogProps) {
  const [releases, setReleases] = useState<ProductRelease[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRelease | null>(null);

  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [shipped, setShipped] = useState(toInputDate(new Date()));

  useEffect(() => {
    // No orderBy in the query (avoids a composite index) — sorted client-side.
    const unsub = onSnapshot(
      query(collection(db, 'product_releases'), where('productId', '==', productId)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ProductRelease[];
        rows.sort((a, b) => (toDate(b.shippedAt)?.getTime() ?? 0) - (toDate(a.shippedAt)?.getTime() ?? 0));
        setReleases(rows);
        onReleasesChange?.(rows);
      },
      (error) => console.error('product_releases snapshot error', error)
    );
    return unsub;
    // onReleasesChange is recreated per render by callers; productId is the real key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const resetForm = () => {
    setVersion('');
    setTitle('');
    setNotes('');
    setShipped(toInputDate(new Date()));
    setAdding(false);
  };

  const add = async () => {
    if (!title.trim()) {
      toast.error('Give the release a title.');
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'product_releases'), {
        productId,
        version: version.trim(),
        title: title.trim(),
        notes: notes.trim(),
        shippedAt: Timestamp.fromDate(new Date(`${shipped}T12:00:00`)),
        createdAt: serverTimestamp(),
      });
      toast.success('Release logged.');
      resetForm();
    } catch (error) {
      console.error('Error adding release:', error);
      toast.error('Could not log the release.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'product_releases', deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting release:', error);
      toast.error('Could not remove the release.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="releases-heading">
      <div className="flex items-center justify-between gap-2">
        <h3 id="releases-heading" className="text-sm font-semibold text-spaceText">Release log</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Log a release
          </Button>
        )}
      </div>

      {adding && (
        <div className="mt-3 space-y-3 rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div>
              <label htmlFor="release-version" className="text-xs text-spaceAlt/85">Version (optional)</label>
              <Input
                id="release-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v0.3"
                className="mt-1 h-9 border-spaceAccent/40 bg-space2 text-spaceText placeholder:text-spaceAlt/55"
              />
            </div>
            <div>
              <label htmlFor="release-title" className="text-xs text-spaceAlt/85">What shipped</label>
              <Input
                id="release-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Barcode scanning"
                className="mt-1 h-9 border-spaceAccent/40 bg-space2 text-spaceText placeholder:text-spaceAlt/55"
              />
            </div>
          </div>

          <div>
            <label htmlFor="release-date" className="text-xs text-spaceAlt/85">Date</label>
            <Input
              id="release-date"
              type="date"
              value={shipped}
              onChange={(e) => setShipped(e.target.value)}
              className="mt-1 h-9 border-spaceAccent/40 bg-space2 text-spaceText"
            />
          </div>

          <div>
            <label htmlFor="release-notes" className="text-xs text-spaceAlt/85">Notes (optional)</label>
            <Textarea
              id="release-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything worth remembering later"
              className="mt-1 border-spaceAccent/40 bg-space2 text-spaceText placeholder:text-spaceAlt/55"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={resetForm} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={add} disabled={busy}>{busy ? 'Saving…' : 'Log release'}</Button>
          </div>
        </div>
      )}

      {releases.length === 0 ? (
        !adding && (
          <p className="mt-3 text-sm text-spaceAlt/80">
            Nothing logged yet. Each entry becomes a dated record of what you shipped.
          </p>
        )
      ) : (
        <ol className="mt-3 space-y-0">
          {releases.map((release) => {
            const when = toDate(release.shippedAt);
            return (
              <li
                key={release.id}
                className="group flex items-start gap-3 border-b border-spaceAccent/10 py-3 last:border-0"
              >
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-spaceAccent" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-spaceText">{release.title}</span>
                    {release.version && (
                      <span className="text-xs font-medium text-spaceAccent">{release.version}</span>
                    )}
                  </div>
                  {release.notes && (
                    <p className="mt-0.5 text-sm text-spaceAlt/85">{release.notes}</p>
                  )}
                  <p className="mt-0.5 text-xs text-spaceAlt/70">
                    {when ? when.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(release)}
                  aria-label={`Remove release ${release.title}`}
                  className="rounded-md p-1.5 text-spaceAlt/50 opacity-0 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}
        title="Remove release"
        description={<>Delete <span className="text-spaceText">{deleteTarget?.title}</span> from the log?</>}
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={remove}
      />
    </section>
  );
}
