export interface Project {
  id: string;
  projectType: string;
  clientName: string;
  status: string;
  completion: number;
  quoteId?: string;
  agreementUrl?: string;
  agreementStatus?: 'pending' | 'approved' | 'declined' | 'signed';
  // ... other existing fields ...
} 