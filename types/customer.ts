export interface Customer {
  id?: string;
  name: string;
  email: string;
  companyName: string;
  contactNumber: string;
  totalSpent: number;
  maintenance: boolean;
  status: boolean;
  created_at?: any; // Firestore Timestamp
} 