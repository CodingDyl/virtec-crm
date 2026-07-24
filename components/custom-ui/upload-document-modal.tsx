'use client'

import { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';
import { DocumentType } from '@/types/document';
import { Project } from '@/types/project';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';

interface UploadDocumentModalProps {
  project: Project;
  /** Optional custom trigger; defaults to an "Upload Document" button. */
  trigger?: React.ReactNode;
  onUploaded?: () => void;
}

const DOC_TYPES: { value: DocumentType; label: string; hint: string }[] = [
  { value: 'quote', label: 'Quote', hint: 'Counts toward revenue & appears in the Quotes tab' },
  { value: 'agreement', label: 'Agreement / Letter of Agreement', hint: 'Sets the project agreement so its status tracks' },
  { value: 'letter', label: 'Letter', hint: 'Stored against this project' },
  { value: 'other', label: 'Other document', hint: 'Any supporting file' },
];

export function UploadDocumentModal({ project, trigger, onUploaded }: UploadDocumentModalProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('quote');
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  const resetForm = () => {
    setDocType('quote');
    setFile(null);
    setAmount('');
    setStatus('pending');
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `documents/projects/${project.id}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      if (docType === 'quote') {
        await addDoc(collection(db, 'quotes'), {
          projectId: project.id,
          clientId: (project as any).clientId ?? '',
          projectType: project.projectType,
          totalAmount: amount ? Number(amount) : 0,
          status,
          pdfUrl: fileUrl,
          source: 'uploaded',
          createdAt: serverTimestamp(),
        });
      } else if (docType === 'agreement') {
        await updateDoc(doc(db, 'projects', project.id), {
          agreementUrl: fileUrl,
          agreementStatus: 'signed',
        });
        await addDoc(collection(db, 'documents'), {
          name: file.name,
          type: docType,
          fileUrl,
          storagePath,
          linkedType: 'project',
          linkedId: project.id,
          uploadedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'documents'), {
          name: file.name,
          type: docType,
          fileUrl,
          storagePath,
          linkedType: 'project',
          linkedId: project.id,
          uploadedAt: serverTimestamp(),
        });
      }

      toast.success('Document uploaded successfully!');
      resetForm();
      setOpen(false);
      onUploaded?.();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-spaceAccent hover:bg-spaceAlt text-spaceText">
            <Upload className="mr-1.5 h-4 w-4" />
            Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-space2 border-spaceAccent">
        <DialogHeader>
          <DialogTitle className="text-spaceText">Upload a document</DialogTitle>
          <DialogDescription className="text-spaceAlt">
            Attach your own quote, letter, or agreement to{' '}
            <span className="text-spaceText">{project.clientName || project.projectType}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-spaceText">Document type</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="mt-1 flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-spaceAlt/80">
              {DOC_TYPES.find((t) => t.value === docType)?.hint}
            </p>
          </div>

          {docType === 'quote' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-spaceText">Amount (R)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  className="mt-1 bg-space1 border-spaceAccent text-spaceText"
                />
              </div>
              <div>
                <Label className="text-spaceText">Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'pending' | 'accepted' | 'rejected')}
                  className="mt-1 flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-spaceText">File (PDF)</Label>
            <Input
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 bg-space1 border-spaceAccent text-spaceText file:text-spaceText file:mr-3"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-spaceAccent hover:bg-spaceAlt text-spaceText disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
