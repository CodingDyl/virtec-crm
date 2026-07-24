import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';

export interface ActivityEntry {
  id: string;
  refType: 'project' | 'customer';
  refId: string;
  type: string;
  message: string;
  createdAt?: any; // Firestore Timestamp
}

/**
 * Append an activity-log entry. Best-effort: failures are logged, never thrown,
 * so activity logging can never break the action that triggered it.
 */
export async function logActivity(
  refType: 'project' | 'customer',
  refId: string,
  type: string,
  message: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'activity'), {
      refType,
      refId,
      type,
      message,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('logActivity failed:', error);
  }
}
