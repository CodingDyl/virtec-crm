'use client'

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { generatePortalToken } from '@/lib/portal-token';
import { logActivity } from '@/lib/activity';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../confirm-dialog";
import { toast } from 'sonner';
import { toDate } from '@/lib/firestore-schema';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Check, Link2, EyeOff } from 'lucide-react';

interface ShareTabProps {
  project: Project;
}

interface PortalState {
  token: string | null;
  enabled: boolean;
  lastViewedAt: any;
}

export function ShareTab({ project }: ShareTabProps) {
  const [state, setState] = useState<PortalState>({ token: null, enabled: false, lastViewedAt: null });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'projects', project.id),
      (snap) => {
        const data = snap.data() ?? {};
        setState({
          token: data.portalToken ?? null,
          enabled: data.portalEnabled !== false,
          lastViewedAt: data.portalLastViewedAt ?? null,
        });
      },
      (error) => console.error('portal state snapshot error', error)
    );
    return unsub;
  }, [project.id]);

  const shareUrl = state.token && origin ? `${origin}/portal/${state.token}` : '';
  const isLive = Boolean(state.token) && state.enabled;

  const createLink = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        portalToken: generatePortalToken(),
        portalEnabled: true,
        portalCreatedAt: serverTimestamp(),
      });
      await logActivity('project', project.id, 'portal', 'Client portal link created');
      toast.success('Share link created.');
    } catch (error) {
      console.error('Error creating portal link:', error);
      toast.error('Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the link and copy it manually.');
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      // Clearing the token, not just the flag, so the old URL can never come back.
      await updateDoc(doc(db, 'projects', project.id), {
        portalToken: null,
        portalEnabled: false,
      });
      await logActivity('project', project.id, 'portal', 'Client portal link revoked');
      toast.success('Link revoked. The old URL no longer works.');
      setRevoking(false);
    } catch (error) {
      console.error('Error revoking portal link:', error);
      toast.error('Could not revoke the link.');
    } finally {
      setBusy(false);
    }
  };

  const lastViewed = toDate(state.lastViewedAt);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-spaceText">Client portal</p>
        <p className="mt-1 text-sm text-spaceAlt/90">
          A read-only page showing progress, documents and quotes. Anyone with the link can open it —
          and approve quotes without emailing you.
        </p>
      </div>

      {!isLive ? (
        <div className="rounded-lg border border-spaceAccent/20 bg-space1/40 p-4 text-center">
          <Link2 className="mx-auto h-7 w-7 text-spaceAccent" aria-hidden="true" />
          <p className="mt-3 text-sm text-spaceText">No share link yet</p>
          <p className="mx-auto mt-1 max-w-prose text-xs text-spaceAlt/85">
            Create one and send it to {project.clientName || 'your client'}. They&rsquo;ll see live
            progress instead of asking for updates.
          </p>
          <Button onClick={createLink} disabled={busy} size="sm" className="mt-4">
            {busy ? 'Creating…' : 'Create share link'}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
            <label htmlFor="portal-url" className="text-xs text-spaceAlt/85">Share this link</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="portal-url"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-spaceAccent/30 bg-space2 px-2.5 py-1.5 text-xs text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
              />
              <button
                type="button"
                onClick={copy}
                aria-label="Copy share link"
                className="shrink-0 rounded-md p-2 text-spaceAccent transition-colors duration-150 hover:bg-spaceAccent/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spaceAccent"
              >
                {copied
                  ? <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
                  : <Copy className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-spaceAlt/80">
            {lastViewed
              ? `Client last opened it ${formatDistanceToNow(lastViewed, { addSuffix: true })}.`
              : 'Not opened yet.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`${shareUrl}?preview=1`} target="_blank" rel="noopener noreferrer">
                Preview as client
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevoking(true)}
              disabled={busy}
              className="border-red-500/40 text-red-300 hover:bg-red-500/15"
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              Revoke link
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title="Revoke share link"
        description={
          <>
            The current link stops working immediately and cannot be restored. You can create a fresh
            link afterwards, but you&rsquo;ll need to send the new URL to{' '}
            <span className="text-spaceText">{project.clientName || 'your client'}</span>.
          </>
        }
        confirmLabel="Revoke link"
        destructive
        loading={busy}
        onConfirm={revoke}
      />
    </div>
  );
}
