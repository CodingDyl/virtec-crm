import { redirect } from 'next/navigation';
import { getOperator } from '@/lib/auth-server';
import { AdminNotConfiguredError } from '@/lib/firebase-admin';
import { AuthGuard } from '@/components/auth-guard';

/**
 * The passwords route renders the same component the dashboard mounts as a tab,
 * but it is directly addressable, so it is verified in its own right.
 */
export default async function PasswordsLayout({ children }: { children: React.ReactNode }) {
  // redirect() signals by throwing, so it is kept clear of the try block.
  let operator = null;
  try {
    operator = await getOperator();
  } catch (error) {
    if (!(error instanceof AdminNotConfiguredError)) throw error;
    console.error('Passwords access attempted without Admin credentials configured.');
  }

  if (!operator) redirect('/');

  return <AuthGuard>{children}</AuthGuard>;
}
