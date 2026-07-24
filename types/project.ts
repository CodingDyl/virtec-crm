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
  // ... other existing fields ...
}