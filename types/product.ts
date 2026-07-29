/**
 * In-house products — Virtara's own software, as distinct from client work.
 *
 * Deliberately not modelled as a Project: a product has no client, no quote and
 * no agreement, so project margin, conversion rate and the client portal are all
 * meaningless for it. Keeping them apart stops one corrupting the other's maths.
 */

export type ProductStage = 'idea' | 'prototype' | 'beta' | 'live' | 'paused' | 'sunset';

export interface ProductLink {
  label: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  /** One line on what it does. */
  tagline: string;
  stage: ProductStage;
  notes: string;
  links: ProductLink[];
  createdAt?: any;
  /** Bumped on every edit; combined with the latest release to date "last touched". */
  updatedAt?: any;
}

export interface ProductRelease {
  id: string;
  productId: string;
  /** Free-form: "v0.3", "2026-07-29", "Beta 2" — whatever the product uses. */
  version: string;
  title: string;
  notes: string;
  shippedAt?: any;
}

export const PRODUCT_STAGES: {
  value: ProductStage;
  label: string;
  hint: string;
  /** Badge classes. Stage is state, so it earns colour. */
  className: string;
}[] = [
  { value: 'idea', label: 'Idea', hint: 'Written down, nothing built', className: 'bg-space1 text-spaceAlt' },
  { value: 'prototype', label: 'Prototype', hint: 'Building; not usable by anyone else yet', className: 'bg-brand-blue/20 text-brand-sky' },
  { value: 'beta', label: 'Beta', hint: 'Real people are using it', className: 'bg-spaceAccent/20 text-spaceAccent' },
  { value: 'live', label: 'Live', hint: 'Publicly available', className: 'bg-green-500/15 text-green-300' },
  { value: 'paused', label: 'Paused', hint: 'Deliberately parked, not abandoned', className: 'bg-yellow-500/15 text-yellow-200' },
  { value: 'sunset', label: 'Sunset', hint: 'Wound down; kept for the record', className: 'bg-space1 text-spaceAlt/60' },
];

export const PRODUCT_STAGE_META: Record<ProductStage, (typeof PRODUCT_STAGES)[number]> =
  PRODUCT_STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage.value]: stage }),
    {} as Record<ProductStage, (typeof PRODUCT_STAGES)[number]>
  );

/** Order used when grouping the list — active work first, wound-down last. */
export const STAGE_ORDER: ProductStage[] = ['live', 'beta', 'prototype', 'idea', 'paused', 'sunset'];

/**
 * Stages where silence is a signal. An idea sitting untouched is fine; a beta
 * nobody has shipped to in two months is the thing worth surfacing.
 */
export const STAGES_THAT_GO_STALE: ProductStage[] = ['prototype', 'beta', 'live'];

/** Days of no activity before a product is called out as going quiet. */
export const STALE_AFTER_DAYS = 30;
