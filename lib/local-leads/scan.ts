export type LocalLeadsScanOptions = {
  track?: 'virtara' | 'jurivo' | 'all';
  radiusMeters?: number;
  lat?: number;
  lng?: number;
  apiKey: string;
};

/** Placeholder until Places client + upsert land. */
export async function runLocalLeadsScan(opts: LocalLeadsScanOptions) {
  return {
    status: 'scaffolded' as const,
    message: 'Places ingest landing; key present but scan not fully implemented yet',
    scanRunId: null,
    fetched: 0,
    upserted: 0,
    track: opts.track ?? 'all',
  };
}
