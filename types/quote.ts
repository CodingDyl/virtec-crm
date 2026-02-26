import { Timestamp } from "firebase/firestore";

export interface Quote {
    projectId: string;
    project_type: string;
    project_id: string;
    clientId: string;             // Canonical client reference
    client_id: string;
    projectType: string;          // Canonical project type
    totalAmount: number;          // Canonical total quote amount
    total_amount: number;         // Legacy total quote amount
    createdAt: Timestamp | Date | null;        // Canonical creation date
    created_at: Timestamp | Date | null;       // Legacy creation date
    status: 'pending' | 'accepted' | 'rejected'; // Quote status
    pdfUrl: string;
    pdf_url: string;             // Legacy URL to the PDF document
    id: string;                  // Add this line
    features?: string[];          // Array of project features/requirements
} 
