'use client'

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/firebaseConfig';

/**
 * The signed-in operator's uid, or null when no one is signed in.
 *
 * Every realtime subscription in the app waits for this before attaching.
 * Firestore rules deny an unauthenticated request on every collection, and a
 * listener rejected with permission-denied is terminal — Firestore does not
 * retry it once a token turns up. Firebase restores the session from
 * IndexedDB asynchronously, so a listener attached at mount races that
 * restore and loses on any cold load, leaving the dashboard permanently
 * empty until the next navigation.
 *
 * Keying the subscriptions on the uid also re-attaches them if the account
 * changes, and tears them down on sign-out.
 */
export function useAuthUid(): string | null {
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null)), []);

  return uid;
}
