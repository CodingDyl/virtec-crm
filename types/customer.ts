export interface Customer {
  id?: string;
  name: string;
  email: string;
  companyName: string;
  contactNumber: string;
  totalSpent: number;
  maintenance: boolean;
  status: boolean;
  createdAt?: any; // Firestore Timestamp
  created_at?: any; // Legacy Firestore Timestamp
} 
