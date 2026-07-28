'use client'

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeletionImpact, totalRecords } from '@/lib/cascade-delete';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being deleted, e.g. "customer" or "project". */
  entityLabel: string;
  /** Display name; also the phrase the user must type when data will be lost. */
  entityName: string;
  /** Resolves the full blast radius. Called each time the dialog opens. */
  loadImpact: () => Promise<DeletionImpact>;
  onConfirm: () => Promise<void>;
}

const IMPACT_ROWS: { key: keyof DeletionImpact; singular: string; plural: string }[] = [
  { key: 'projects', singular: 'project', plural: 'projects' },
  { key: 'quotes', singular: 'quote', plural: 'quotes' },
  { key: 'invoices', singular: 'maintenance invoice', plural: 'maintenance invoices' },
  { key: 'documents', singular: 'document', plural: 'documents' },
  { key: 'expenses', singular: 'linked expense', plural: 'linked expenses' },
  { key: 'tasks', singular: 'task', plural: 'tasks' },
  { key: 'designItems', singular: 'design idea', plural: 'design ideas' },
  { key: 'activity', singular: 'activity entry', plural: 'activity entries' },
];

export function DeleteEntityDialog({
  open,
  onOpenChange,
  entityLabel,
  entityName,
  loadImpact,
  onConfirm,
}: DeleteEntityDialogProps) {
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) {
      setImpact(null);
      setTyped('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadImpact()
      .then((result) => { if (!cancelled) setImpact(result); })
      .catch((error) => {
        console.error('Failed to load deletion impact:', error);
        if (!cancelled) setImpact(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // loadImpact is recreated per render by callers; keying on `open` is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = useMemo(
    () => (impact ? IMPACT_ROWS.filter((r) => (impact[r.key] as number) > 0) : []),
    [impact]
  );

  const attachedRecords = impact ? totalRecords(impact) : 0;
  // Typing the name is only worth demanding when real data goes with it.
  const requiresTyping = attachedRecords > 0;
  const canDelete = !loading && !deleting && (!requiresTyping || typed.trim() === entityName.trim());

  const handleConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller surfaces the failure; keep the dialog open so the user can retry.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!deleting) onOpenChange(next); }}>
      <DialogContent className="bg-space2 border-red-500/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-spaceText">
            <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
            Delete {entityLabel}
          </DialogTitle>
          <DialogDescription className="text-spaceAlt/90">
            <span className="text-spaceText">{entityName}</span> and everything attached to it will be
            removed permanently. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-spaceAccent/20 bg-space1/60 p-4">
          {loading ? (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
              <p className="text-sm text-spaceAlt/80">Checking what is linked…</p>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3.5 animate-pulse rounded-sm bg-spaceAccent/10"
                  style={{ width: `${72 - i * 14}%` }}
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-spaceAlt/90">
              Nothing else is linked to this {entityLabel} — only the {entityLabel} record will be removed.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-spaceText">This will also delete:</p>
              <ul className="mt-2 space-y-1.5">
                {rows.map((row) => {
                  const count = impact![row.key] as number;
                  return (
                    <li key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-spaceAlt/90">{count === 1 ? row.singular : row.plural}</span>
                      <span className="font-semibold tabular-nums text-spaceText">{count}</span>
                    </li>
                  );
                })}
              </ul>
              {impact!.files > 0 && (
                <p className="mt-3 border-t border-spaceAccent/15 pt-2 text-xs text-spaceAlt/75">
                  {impact!.files} uploaded {impact!.files === 1 ? 'file' : 'files'} will be erased from
                  storage as well.
                </p>
              )}
            </>
          )}
        </div>

        {requiresTyping && !loading && (
          <div>
            <Label htmlFor="delete-confirm" className="text-sm text-spaceText">
              Type <span className="font-semibold">{entityName}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={entityName}
              className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/50"
            />
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="sm:min-w-24"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canDelete}
            className="sm:min-w-44"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {deleting ? 'Deleting…' : `Delete ${entityLabel} permanently`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
