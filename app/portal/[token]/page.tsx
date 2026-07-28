import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPortalData } from '@/lib/portal';
import { PortalView } from './PortalView';

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
  const data = await fetchPortalData(token, { recordView: preview !== '1' });

  if (!data) notFound();

  return <PortalView data={data} token={token} />;
}
