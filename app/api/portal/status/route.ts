import { NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Whether this deployment can serve portal pages. Used by the Share tab to
 * warn before a link is sent to a client, rather than after. Reveals only a
 * boolean about the deployment's own configuration.
 */
export async function GET() {
  return NextResponse.json({ configured: isAdminConfigured() });
}
