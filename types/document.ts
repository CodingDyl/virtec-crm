export type DocumentType = 'quote' | 'letter' | 'agreement' | 'other';

export interface BusinessDocument {
  id: string;
  name: string;
  type: DocumentType;
  fileUrl: string;
  storagePath: string;
  linkedType: 'project' | 'customer';
  linkedId: string;
  uploadedAt?: any; // Firestore Timestamp
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quote: 'Quote',
  letter: 'Letter',
  agreement: 'Agreement',
  other: 'Other',
};
