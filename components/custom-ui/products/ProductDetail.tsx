'use client'

import { useEffect, useState } from 'react';
import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Product, ProductLink, ProductRelease, ProductStage, PRODUCT_STAGES } from '@/types/product';
import { isGoingQuiet, labelFromUrl, lastTouched, normalizeUrl, relativeDay } from '@/lib/products';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "../confirm-dialog";
import { ReleaseLog } from './ReleaseLog';
import { toast } from 'sonner';
import { ExternalLink, Plus, Trash2, X, Clock } from 'lucide-react';

interface ProductDetailProps {
  product: Product;
  onDeleted: () => void;
}

const fieldClass =
  "flex h-10 w-full rounded-md border border-spaceAccent/40 bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

export function ProductDetail({ product, onDeleted }: ProductDetailProps) {
  const [name, setName] = useState(product.name);
  const [tagline, setTagline] = useState(product.tagline);
  const [stage, setStage] = useState<ProductStage>(product.stage);
  const [notes, setNotes] = useState(product.notes);
  const [links, setLinks] = useState<ProductLink[]>(product.links);
  const [releases, setReleases] = useState<ProductRelease[]>([]);

  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form whenever a different product is selected.
  useEffect(() => {
    setName(product.name);
    setTagline(product.tagline);
    setStage(product.stage);
    setNotes(product.notes);
    setLinks(product.links);
    setLinkUrl('');
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const touched = lastTouched(product, releases);
  const quiet = isGoingQuiet(product, touched);

  const dirty =
    name !== product.name ||
    tagline !== product.tagline ||
    stage !== product.stage ||
    notes !== product.notes ||
    JSON.stringify(links) !== JSON.stringify(product.links);

  const save = async (overrides?: Partial<Product>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        name: name.trim() || 'Untitled',
        tagline: tagline.trim(),
        stage,
        notes,
        links,
        ...overrides,
        updatedAt: serverTimestamp(),
      });
      toast.success('Saved.');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    const url = normalizeUrl(linkUrl);
    if (!url) return;
    if (links.some((l) => l.url === url)) {
      toast.error('That link is already here.');
      return;
    }
    setLinks([...links, { label: labelFromUrl(url), url }]);
    setLinkUrl('');
  };

  const remove = async () => {
    setDeleting(true);
    try {
      // Releases point back at this product; they go with it.
      const releaseSnap = await getDocs(
        query(collection(db, 'product_releases'), where('productId', '==', product.id))
      );
      if (releaseSnap.size > 0) {
        const batch = writeBatch(db);
        releaseSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'products', product.id));
      toast.success(`${product.name} deleted.`);
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Could not delete the product.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    /* No fixed height or internal scroll: in a grid row the pane would inherit
       its height from the short product list beside it, trapping the release
       log in a cramped scroll box. It grows, and the page scrolls. */
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Product name"
            className="h-auto border-0 bg-transparent px-0 text-xl font-semibold text-spaceText focus-visible:ring-0"
          />
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line on what it does"
            aria-label="Tagline"
            className="h-auto border-0 bg-transparent px-0 text-sm text-spaceAlt/90 placeholder:text-spaceAlt/50 focus-visible:ring-0"
          />
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label={`Delete ${product.name}`}
          title="Delete product"
          className="shrink-0 rounded-md p-1.5 text-spaceAlt/70 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="detail-stage" className="sr-only">Stage</label>
          <select
            id="detail-stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as ProductStage)}
            className={`h-9 w-auto ${fieldClass}`}
          >
            {PRODUCT_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-spaceAlt/85">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Last touched {relativeDay(touched)}
        </p>
      </div>

      {/* The one judgement this page makes: a shipping product that has gone silent. */}
      {quiet && (
        <p className="rounded-lg border border-yellow-500/35 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          Nothing has happened here in over a month, and it&rsquo;s marked{' '}
          {PRODUCT_STAGES.find((s) => s.value === product.stage)?.label.toLowerCase()}. Still live in
          your head, or should it be paused?
        </p>
      )}

      <div>
        <label htmlFor="product-notes" className="text-sm font-semibold text-spaceText">Notes</label>
        <Textarea
          id="product-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="What it is, who it's for, what's next, what you decided and why."
          className="mt-2 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-spaceText">Links</h3>
        {links.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {links.map((link) => (
              <li key={link.url} className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-spaceAccent/20 px-3 py-2 text-sm text-spaceText transition-colors duration-150 hover:border-spaceAccent/45 hover:bg-space1/60"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-spaceAccent" aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((l) => l.url !== link.url))}
                  aria-label={`Remove link ${link.label}`}
                  className="rounded-md p-1.5 text-spaceAlt/60 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="Repo, live site, design file, docs…"
            aria-label="Add a link"
            className="h-9 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
          />
          <Button size="sm" variant="outline" onClick={addLink} disabled={!linkUrl.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {/* Shown only when there is something to save — a permanent disabled
          button is just a dead bar taking the eye's most prominent slot. */}
      {dirty ? (
        <Button onClick={() => save()} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      ) : (
        <p className="text-center text-xs text-spaceAlt/60">All changes saved</p>
      )}

      <div className="border-t border-spaceAccent/15 pt-5">
        <ReleaseLog productId={product.id} onReleasesChange={setReleases} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete product"
        description={
          <>
            Remove <span className="text-spaceText">{product.name}</span> and its
            {releases.length > 0 ? ` ${releases.length} logged release${releases.length === 1 ? '' : 's'}` : ' release log'}?
            This cannot be undone.
          </>
        }
        confirmLabel="Delete product"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
