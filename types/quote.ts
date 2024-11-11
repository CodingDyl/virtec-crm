import { Timestamp } from "firebase/firestore";

export interface Quote {
    project_id: string | null;    // Reference to project
    clientId: string;             // Reference to client
    projectType: string;          // Type of project
    total_amount: number;         // Total quote amount
    created_at: Timestamp;        // Creation date
    status: 'pending' | 'accepted' | 'rejected'; // Quote status
    pdf_url: string;             // URL to the PDF document
}