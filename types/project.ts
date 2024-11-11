export interface Project {
  id: string;
  projectType: string;
  clientId: string;
  clientName: string;
  status: 'active' | 'completed' | 'on-hold';
  quoteId: string;
  completion: number;
} 