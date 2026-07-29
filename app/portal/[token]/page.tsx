import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPortalData } from '@/lib/portal';
import { AdminNotConfiguredError } from '@/lib/firebase-admin';
import { PortalView } from './PortalView';
import { PortalUnavailable } from './PortalUnavailable';

// The client's data must never come from a build-time snapshot.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project status | Virtara',
  description: 'Live status, documents and quotes for your project.',
  robots: { index: false, follow: false },
};

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ token }, { preview }] = await Promise.all([params, searchParams]);

  let data;
  try {
    data = await fetchPortalData(token, { recordView: preview !== '1' });
  } catch (error) {
    // A missing credential is an operator problem, not a dead link — saying
    // "not found" here would send the client chasing a link that is fine.
    if (error instanceof AdminNotConfiguredError) {
      console.error('Portal request served without Admin credentials configured.');
      return <PortalUnavailable />;
    }
    throw error;
  }

  if (!data) notFound();

  return <PortalView data={data} token={token} />;
}
