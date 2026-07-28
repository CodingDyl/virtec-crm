import { MaintenanceFrequency } from './maintenance';

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
  /**
   * Maintenance projects bill on a repeating cycle rather than against a single
   * quote. These fields are absent on every other kind of project.
   */
  maintenanceFrequency?: MaintenanceFrequency;
  /** Expected charge per billing cycle, in Rand. */
  maintenanceAmount?: number;
  // ... other existing fields ...
}