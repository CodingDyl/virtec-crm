'use client'

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "../confirm-dialog";
import { logActivity } from '@/lib/activity';
import { toast } from 'react-toastify';
import { ImagePlus, Link2, Trash2, ExternalLink } from 'lucide-react';

interface DesignItem {
  id: string;
  projectId: string;
  kind: 'image' | 'link';
  url: string;
  storagePath?: string;
  title: string;
  createdAt?: any;
}

interface DesignTabProps {
  project: Project;
}

export function DesignTab({ project }: DesignTabProps) {
  const [items, setItems] = useState<DesignItem[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DesignItem | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'design_items'), where('projectId', '==', project.id)),
      (snap) => setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as DesignItem[]),
      (err) => console.error('design_items snapshot error', err)
    );
    return unsub;
  }, [project.id]);

  const addLink = async () => {
    const raw = linkUrl.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      await addDoc(collection(db, 'design_items'), {
        projectId: project.id, kind: 'link', url, title: url, createdAt: serverTimestamp(),
      });
      await logActivity('project', project.id, 'design', 'Added a design link');
      setLinkUrl('');
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error('Failed to add link.');
    } finally {
      setBusy(false);
    }
  };

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `design/projects/${project.id}/${Date.now()}_${safe}`;
        const sref = ref(storage, storagePath);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        await addDoc(collection(db, 'design_items'), {
          projectId: project.id, kind: 'image', url, storagePath, title: file.name, createdAt: serverTimestamp(),
        });
        await logActivity('project', project.id, 'design', `Added a design image: ${file.name}`);
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Failed to upload image.');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.storagePath) {
        try { await deleteObject(ref(storage, deleteTarget.storagePath)); } catch { /* already gone */ }
      }
      await deleteDoc(doc(db, 'design_items', deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error removing design item:', error);
      toast.error('Failed to remove item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-semibold text-spaceText">Design ideas</p>
        <Button size="sm" onClick={addImage} disabled={busy} className="bg-spaceAccent hover:bg-spaceAlt text-spaceText">
          <ImagePlus className="mr-1 h-4 w-4" /> Image
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
          placeholder="Paste a link (Figma, Canva, live site…)"
          className="bg-space1 border-spaceAccent text-spaceText"
        />
        <Button size="sm" onClick={addLink} disabled={busy || !linkUrl.trim()} variant="outline" className="border-spaceAccent/40 bg-space1 text-spaceText">
          <Link2 className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No design ideas yet. Add reference images or paste links to inspiration.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-lg border border-spaceAccent/25 bg-space1/50">
              {item.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.title} className="h-28 w-full object-cover" />
              ) : (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                   className="flex h-28 flex-col items-center justify-center gap-1 p-2 text-center">
                  <Link2 className="h-5 w-5 text-spaceAccent" />
                  <span className="line-clamp-2 break-all text-xs text-spaceAlt">{item.title}</span>
                </a>
              )}
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => window.open(item.url, '_blank')}
                        className="rounded bg-black/60 p-1 text-spaceText hover:bg-black/80" aria-label="Open">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(item)}
                        className="rounded bg-black/60 p-1 text-red-300 hover:bg-black/80" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove design idea?"
        description="This removes the item from the project's design board."
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={remove}
      />
    </div>
  );
}
