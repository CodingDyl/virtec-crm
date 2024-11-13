import { Timestamp } from "firebase/firestore";

export interface Quote {
    project_id: string;
    client_id: string;             // Reference to client
    project_type: string;          // Type of project
    total_amount: number;         // Total quote amount
    created_at: Timestamp;        // Creation date
    status: 'pending' | 'accepted' | 'rejected'; // Quote status
    pdf_url: string;             // URL to the PDF document
    id: string;                  // Add this line
    features?: string[];          // Array of project features/requirements
}