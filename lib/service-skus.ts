export type ServiceSkuId = 'care' | 'seo' | 'bundle';

export interface ServiceSku {
  id: ServiceSkuId;
  name: string;
  monthlyPriceZar: number;
  includes: string;
}

/** Locked Virtara recurring SKUs (Delivery Ops). Not newsletters; not in-house Products. */
export const SERVICE_SKUS: ServiceSku[] = [
  {
    id: 'care',
    name: 'Care',
    monthlyPriceZar: 1990,
    includes: 'Hosting, updates, backups, uptime monitoring, 2h small fixes',
  },
  {
    id: 'seo',
    name: 'SEO',
    monthlyPriceZar: 3990,
    includes: 'Local + target keywords, Google Business Profile, monthly report',
  },
  {
    id: 'bundle',
    name: 'Bundle',
    monthlyPriceZar: 5490,
    includes: 'Care + SEO combined retainer',
  },
];

export const SERVICE_SKU_BY_ID: Record<ServiceSkuId, ServiceSku> = SERVICE_SKUS.reduce(
  (acc, sku) => {
    acc[sku.id] = sku;
    return acc;
  },
  {} as Record<ServiceSkuId, ServiceSku>
);

export function serviceSkuPrice(id?: ServiceSkuId | null): number {
  if (!id) return 0;
  return SERVICE_SKU_BY_ID[id]?.monthlyPriceZar ?? 0;
}

export function getServiceSku(id?: string | null): ServiceSku | null {
  if (!id) return null;
  return SERVICE_SKU_BY_ID[id as ServiceSkuId] ?? null;
}

export function isServiceSkuId(value: string): value is ServiceSkuId {
  return value in SERVICE_SKU_BY_ID;
}

export function resolveMaintenanceAmount(args: {
  serviceSku?: ServiceSkuId | null;
  maintenanceAmount?: number | null;
}): number {
  const fromSku = serviceSkuPrice(args.serviceSku);
  if (fromSku > 0) return fromSku;
  return typeof args.maintenanceAmount === 'number' && Number.isFinite(args.maintenanceAmount)
    ? args.maintenanceAmount
    : 0;
}

/**
 * Amount used for MRR / billing maths. Linked SKU wins when set; otherwise the
 * explicit maintenanceAmount so custom retainers still work.
 */
export function effectiveMaintenanceAmount(project: {
  serviceSku?: ServiceSkuId | string | null;
  maintenanceAmount?: number | null;
}): number {
  const raw = project.serviceSku || null;
  const sku = raw && raw in SERVICE_SKU_BY_ID ? (raw as ServiceSkuId) : null;
  return resolveMaintenanceAmount({
    serviceSku: sku,
    maintenanceAmount: project.maintenanceAmount,
  });
}
