import { MaintenanceFrequency } from './maintenance';
import { ServiceSkuId } from './service-sku';

export interface Project {
  id: string;
  projectType: string;
  clientName: string;
  clientId?: string;
  amount?: number;
  status: string;
  completion: number;
  quoteId?: string;
  /** Legacy permanent download URL for the signed agreement. */
  agreementUrl?: string;
  /** Bucket path; resolved to a signed URL on demand. */
  agreementPath?: string;
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
  /** Virtara recurring SKU: care | seo | bundle */
  serviceSku?: ServiceSkuId | null;
  /**
   * Delivery Ops: when set, the project is blocked waiting on the client.
   * After 5 business days of silence the clock pauses (status → on-hold).
   */
  waitingOnClientSince?: any;
  pausedAt?: any;
  pauseReason?: string | null;
}
