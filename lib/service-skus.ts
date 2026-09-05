export type SiteKind = 'website' | 'ecommerce';
export type ServiceLineId = 'hosting' | 'maintenance' | 'seo';

/** @deprecated Prefer serviceLines + siteKind. Kept for legacy records / display shortcuts. */
export type ServiceSkuId = 'care' | 'seo' | 'bundle' | 'hosting' | 'maintenance';

export interface ServiceSku {
  id: ServiceSkuId;
  name: string;
  monthlyPriceZar: number;
  includes: string;
}

export const SITE_KINDS = [
  { id: 'website' as const, label: 'Website' },
  { id: 'ecommerce' as const, label: 'E-commerce' },
];

export const SERVICE_LINE_OPTIONS: Array<{ id: ServiceLineId; label: string }> = [
  { id: 'hosting', label: 'Hosting' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'seo', label: 'SEO' },
];

/** Locked matrix 2026-09-05 */
export const RETAINER_MATRIX: Record<
  SiteKind,
  {
    hosting: number;
    maintenance: number;
    care: number; // = hosting+maintenance shortcut
    seo: number;
    bundle: number; // = care+seo
  }
> = {
  website: { hosting: 500, maintenance: 1200, care: 1700, seo: 3990, bundle: 5690 },
  ecommerce: { hosting: 800, maintenance: 1800, care: 2500, seo: 3990, bundle: 6490 },
};

export function normalizeSiteKind(
  projectType?: string | null,
  siteKind?: SiteKind | null
): SiteKind {
  if (siteKind === 'website' || siteKind === 'ecommerce') return siteKind;
  const t = (projectType || '').toLowerCase();
  if (
    t.includes('e-com') ||
    t.includes('ecom') ||
    t.includes('commerce') ||
    t.includes('shop')
  ) {
    return 'ecommerce';
  }
  return 'website';
}

export function linesFromCareShortcut(includeSeo: boolean): ServiceLineId[] {
  return includeSeo ? ['hosting', 'maintenance', 'seo'] : ['hosting', 'maintenance'];
}

export function toggleLine(
  lines: ServiceLineId[],
  line: ServiceLineId,
  on: boolean
): ServiceLineId[] {
  const set = new Set(lines);
  if (on) set.add(line);
  else set.delete(line);
  return (['hosting', 'maintenance', 'seo'] as ServiceLineId[]).filter((l) => set.has(l));
}

export function applyCareShortcut(includeSeo: boolean): ServiceLineId[] {
  return linesFromCareShortcut(includeSeo);
}

export function isCareSelection(lines: ServiceLineId[]): boolean {
  return lines.includes('hosting') && lines.includes('maintenance');
}

export function isBundleSelection(lines: ServiceLineId[]): boolean {
  return isCareSelection(lines) && lines.includes('seo');
}

export function computeRetainerMonthly(siteKind: SiteKind, lines: ServiceLineId[]): number {
  const m = RETAINER_MATRIX[siteKind];
  if (isBundleSelection(lines)) return m.bundle;
  if (isCareSelection(lines) && !lines.includes('seo')) return m.care;
  let total = 0;
  if (lines.includes('hosting')) total += m.hosting;
  if (lines.includes('maintenance')) total += m.maintenance;
  if (lines.includes('seo')) total += m.seo;
  return total;
}

/** Legacy flat SKU → lines */
export function migrateLegacyServiceSku(sku?: string | null): ServiceLineId[] {
  switch (sku) {
    case 'care':
      return ['hosting', 'maintenance'];
    case 'seo':
      return ['seo'];
    case 'bundle':
      return ['hosting', 'maintenance', 'seo'];
    case 'hosting':
      return ['hosting'];
    case 'maintenance':
      return ['maintenance'];
    default:
      return [];
  }
}

/** Sync legacy serviceSku when selection matches a package shortcut; else null. */
export function legacySkuFromLines(lines: ServiceLineId[]): ServiceSkuId | null {
  if (isBundleSelection(lines)) return 'bundle';
  if (isCareSelection(lines) && !lines.includes('seo')) return 'care';
  if (lines.length === 1 && lines[0] === 'seo') return 'seo';
  if (lines.length === 1 && lines[0] === 'hosting') return 'hosting';
  if (lines.length === 1 && lines[0] === 'maintenance') return 'maintenance';
  return null;
}

export function resolveServiceLines(project: {
  serviceLines?: ServiceLineId[] | null;
  serviceSku?: string | null;
}): ServiceLineId[] {
  if (project.serviceLines && project.serviceLines.length > 0) return project.serviceLines;
  return migrateLegacyServiceSku(project.serviceSku);
}

export function effectiveMaintenanceAmount(project: {
  siteKind?: SiteKind | null;
  projectType?: string;
  serviceLines?: ServiceLineId[] | null;
  serviceSku?: string | null;
  maintenanceAmount?: number | null;
}): number {
  const kind = normalizeSiteKind(project.projectType, project.siteKind);
  const lines = resolveServiceLines(project);
  if (lines.length > 0) return computeRetainerMonthly(kind, lines);
  return typeof project.maintenanceAmount === 'number' && Number.isFinite(project.maintenanceAmount)
    ? project.maintenanceAmount
    : 0;
}

/** Package shortcuts for UI labels — website matrix prices as default display. */
export const SERVICE_SKUS: ServiceSku[] = [
  {
    id: 'care',
    name: 'Care',
    monthlyPriceZar: RETAINER_MATRIX.website.care,
    includes: 'Hosting + Maintenance package shortcut',
  },
  {
    id: 'seo',
    name: 'SEO',
    monthlyPriceZar: RETAINER_MATRIX.website.seo,
    includes: 'Local + target keywords, Google Business Profile, monthly report',
  },
  {
    id: 'bundle',
    name: 'Bundle',
    monthlyPriceZar: RETAINER_MATRIX.website.bundle,
    includes: 'Care + SEO combined retainer',
  },
];

export const SERVICE_SKU_BY_ID: Partial<Record<ServiceSkuId, ServiceSku>> = SERVICE_SKUS.reduce(
  (acc, sku) => {
    acc[sku.id] = sku;
    return acc;
  },
  {} as Partial<Record<ServiceSkuId, ServiceSku>>
);

export function serviceSkuPrice(id?: string | null, siteKind: SiteKind = 'website'): number {
  if (!id) return 0;
  return computeRetainerMonthly(siteKind, migrateLegacyServiceSku(id));
}

export function getServiceSku(id?: string | null): ServiceSku | null {
  if (!id) return null;
  const known = SERVICE_SKU_BY_ID[id as ServiceSkuId];
  if (known) return known;
  const lines = migrateLegacyServiceSku(id);
  if (lines.length === 0) return null;
  const price = computeRetainerMonthly('website', lines);
  return {
    id: id as ServiceSkuId,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    monthlyPriceZar: price,
    includes: lines.join(' + '),
  };
}

export function isServiceSkuId(value: string): value is ServiceSkuId {
  return ['care', 'seo', 'bundle', 'hosting', 'maintenance'].includes(value);
}

/** @deprecated Prefer effectiveMaintenanceAmount with siteKind/serviceLines. */
export function resolveMaintenanceAmount(args: {
  serviceSku?: ServiceSkuId | null;
  maintenanceAmount?: number | null;
  siteKind?: SiteKind | null;
}): number {
  return effectiveMaintenanceAmount({
    serviceSku: args.serviceSku,
    maintenanceAmount: args.maintenanceAmount,
    siteKind: args.siteKind,
  });
}

export function formatZarAmount(amount: number): string {
  return `R${Math.round(amount).toLocaleString('en-ZA')}`;
}
