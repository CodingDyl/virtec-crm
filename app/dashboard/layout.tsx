import { redirect } from 'next/navigation';
import { getOperator } from '@/lib/auth-server';
import { AdminNotConfiguredError } from '@/lib/firebase-admin';
import { AuthGuard } from '@/components/auth-guard';

/**
 * The security gate for the CRM.
 *
 * This is a server component, so an unverified visitor never receives the
 * dashboard's markup at all — the children below are never rendered. AuthGuard
 * still wraps them to keep the client in step when a session expires mid-visit
 * without a navigation, but this check is the one that matters.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // redirect() signals by throwing, so it is kept clear of the try block.
  let operator = null;
  try {
    operator = await getOperator();
  } catch (error) {
    if (!(error instanceof AdminNotConfiguredError)) throw error;
    // Failing closed is the only safe direction: without credentials the
    // server cannot tell an operator from anyone else.
    console.error('Dashboard access attempted without Admin credentials configured.');
  }

  if (!operator) redirect('/');

  return <AuthGuard>{children}</AuthGuard>;
}
