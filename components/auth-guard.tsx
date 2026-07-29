'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/firebaseConfig';
import { Button } from "@/components/ui/button";
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { ShieldAlert } from 'lucide-react';

type GuardState =
  | { phase: 'checking' }
  | { phase: 'allowed' }
  | { phase: 'denied'; email: string | null };

/**
 * Gates the CRM behind Firebase Auth.
 *
 * Being signed in is not sufficient. The Firebase config ships in the browser
 * bundle, so anyone can create an account against this project — authorisation
 * comes from an `operators/{uid}` document that only the console can write.
 * Firestore rules enforce the same check; this exists so an unauthorised user
 * sees a clear message instead of a dashboard where every query fails.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({ phase: 'checking' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        router.replace('/');
        return;
      }

      try {
        const operator = await getDoc(doc(db, 'operators', user.uid));
        setState(operator.exists() ? { phase: 'allowed' } : { phase: 'denied', email: user.email });
      } catch (error) {
        // Rules deny the read for anyone not on the allowlist, so a failure
        // here means the same thing as a missing document.
        console.error('operator check failed:', error);
        setState({ phase: 'denied', email: user.email });
      }
    });

    return unsubscribe;
  }, [router]);

  if (state.phase === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Quantum size="80" speed="1.75" color="white" />
        <p className="text-spaceText">Checking your access…</p>
      </div>
    );
  }

  if (state.phase === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-2xl border border-spaceAccent/25 bg-space2/60 p-8 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-yellow-400" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-spaceText">This account has no access</h1>
          <p className="mt-2 text-sm text-spaceAlt/90">
            {state.email ? (
              <><span className="text-spaceText">{state.email}</span> is signed in, but it is not an
              authorised operator of this workspace.</>
            ) : (
              'This account is not an authorised operator of this workspace.'
            )}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await signOut(auth);
              router.replace('/');
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
