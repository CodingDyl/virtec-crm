export interface Project {
  id: string;
  projectType: string;
  clientName: string;
  status: string;
  completion: number;
  quoteId?: string;
  agreementUrl?: string;
  agreementStatus: 'approved' | 'declined' | 'pending' | null;
  // ... other existing fields ...
} 