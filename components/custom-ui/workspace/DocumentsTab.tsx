'use client'

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { BusinessDocument, DOCUMENT_TYPE_LABELS } from '@/types/document';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadDocumentModal } from "../upload-document-modal";
import { ConfirmDialog } from "../confirm-dialog";
import { toast } from 'react-toastify';
import { FileText, ExternalLink, Trash2 } from 'lucide-react';

interface DocumentsTabProps {
  project: Project;
}

export function DocumentsTab({ project }: DocumentsTabProps) {
  const [docs, setDocs] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BusinessDocument | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'documents'), where('linkedId', '==', project.id)),
      (snap) => {
        setDocs(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as BusinessDocument[]);
        setLoading(false);
      },
      (err) => { console.error('documents snapshot error', err); setLoading(false); }
    );
    return unsub;
  }, [project.id]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.storagePath) {
        try { await deleteObject(ref(storage, deleteTarget.storagePath)); } catch { /* already gone */ }
      }
      await deleteDoc(doc(db, 'documents', deleteTarget.id));
      if (deleteTarget.type === 'agreement') {
        await updateDoc(doc(db, 'projects', project.id), { agreementUrl: null, agreementStatus: null });
      }
      toast.success('Document removed.');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to remove document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-spaceText">Documents</p>
        <UploadDocumentModal project={project} />
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No documents yet. Use "Upload Document" to add a quote, letter, or agreement.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-spaceAccent/25 bg-space1/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-spaceAccent" />
                <span className="truncate text-sm text-spaceText">{d.name}</span>
                <Badge variant="secondary" className="shrink-0 capitalize">{DOCUMENT_TYPE_LABELS[d.type] ?? d.type}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" className="text-spaceAccent hover:text-spaceText" onClick={() => window.open(d.fileUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove document?"
        description={<>Remove <span className="text-spaceText">{deleteTarget?.name}</span> from this project?</>}
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
