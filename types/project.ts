export interface Project {
  id: string;
  projectType: string;
  clientName: string;
  clientId?: string;
  amount?: number;
  status: string;
  completion: number;
  quoteId?: string;
  agreementUrl?: string;
  agreementStatus?: 'pending' | 'approved' | 'declined' | 'signed';
  createdAt?: any; // Firestore Timestamp
  /** Client portal share link. Null once revoked — the old URL never comes back. */
  portalToken?: string | null;
  portalEnabled?: boolean;
  portalCreatedAt?: any; // Firestore Timestamp
  portalLastViewedAt?: any; // Firestore Timestamp
  // ... other existing fields ...
}