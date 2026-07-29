'use client'

import { useEffect, useMemo, useState } from 'react';
import { useProducts } from '@/contexts/DataContexts';
import { Product, PRODUCT_STAGE_META, STAGE_ORDER } from '@/types/product';
import { lastTouched, relativeDay } from '@/lib/products';
import { AddProductModal } from './AddProductModal';
import { ProductDetail } from './ProductDetail';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { Boxes } from 'lucide-react';

export default function ProductsSection() {
  const { products, isLoading } = useProducts();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId]
  );

  // Land on something rather than an empty pane, and recover if the
  // selected product is deleted from under us.
  useEffect(() => {
    if (products.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!products.some((p) => p.id === selectedId)) {
      setSelectedId(products[0].id);
    }
  }, [products, selectedId]);

  /** Grouped by stage, active work first. */
  const grouped = useMemo(() => {
    return STAGE_ORDER.map((stage) => ({
      stage,
      items: products.filter((p) => p.stage === stage),
    })).filter((group) => group.items.length > 0);
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Quantum size="100" speed="1.75" color="white" />
        <p className="text-spaceText">Loading products…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="virtara-display text-2xl text-spaceText">Products</h2>
          <AddProductModal onAdded={setSelectedId} />
        </div>
        <p className="mt-2 max-w-prose text-sm text-spaceAlt/90">
          Virtara&rsquo;s own software — what stage each one is at, what shipped, and what you were
          thinking last time you touched it.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-spaceAccent/20 bg-space2/50 px-6 py-14 text-center">
          <Boxes className="mx-auto h-9 w-9 text-spaceAccent" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-spaceText">No products yet</h3>
          <p className="mx-auto mt-2 max-w-prose text-sm text-spaceAlt/90">
            This is for the things Virtara owns rather than builds for a client — Pantry Pilot,
            VoxMachine, and whatever comes next. Client work stays in the Workspace, where it can have
            quotes and margins; products live here, where they can just be ideas for a while.
          </p>
          <div className="mt-6 flex justify-center">
            <AddProductModal onAdded={setSelectedId} />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <nav
            aria-label="Products"
            className="h-fit rounded-2xl border border-spaceAccent/25 bg-space2/50 p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto"
          >
            {grouped.map((group) => {
              const meta = PRODUCT_STAGE_META[group.stage];
              return (
                <div key={group.stage} className="mb-4 last:mb-0">
                  <p className="px-2 pb-1.5 text-xs font-medium text-spaceAlt/70">
                    {meta.label}
                    <span className="ml-1.5 text-spaceAlt/50">{group.items.length}</span>
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((product) => (
                      <li key={product.id}>
                        <ProductRow
                          product={product}
                          selected={product.id === selectedId}
                          onSelect={() => setSelectedId(product.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>

          <div className="min-h-[420px] rounded-2xl border border-spaceAccent/25 bg-space2/50 p-5">
            {selected ? (
              <ProductDetail
                key={selected.id}
                product={selected}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-center text-sm text-spaceAlt/70">
                Select a product to open it.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  selected,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  // Releases are not loaded for the list, so this dates from the product record
  // alone. The detail pane refines it once its release log has loaded.
  const touched = lastTouched(product, []);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 ${
        selected
          ? 'border border-spaceAccent bg-spaceAccent/15 text-spaceText'
          : 'border border-transparent text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
      }`}
    >
      <span className="block truncate text-sm font-medium">{product.name}</span>
      <span className="block truncate text-xs text-spaceAlt/70">
        {product.tagline || `Updated ${relativeDay(touched)}`}
      </span>
    </button>
  );
}
