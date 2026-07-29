'use client'

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { ProductStage, PRODUCT_STAGES } from '@/types/product';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface AddProductModalProps {
  onAdded?: (id: string) => void;
  trigger?: React.ReactNode;
}

const fieldClass =
  "flex h-10 w-full rounded-md border border-spaceAccent/40 bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

export function AddProductModal({ onAdded, trigger }: AddProductModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [stage, setStage] = useState<ProductStage>('idea');

  const reset = () => {
    setName('');
    setTagline('');
    setStage('idea');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Give the product a name.');
      return;
    }

    setSaving(true);
    try {
      const created = await addDoc(collection(db, 'products'), {
        name: name.trim(),
        tagline: tagline.trim(),
        stage,
        notes: '',
        links: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`${name.trim()} added.`);
      reset();
      setOpen(false);
      onAdded?.(created.id);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Could not add the product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); if (!next) reset(); } }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-space2 border-spaceAccent/40">
        <DialogHeader>
          <DialogTitle className="text-spaceText">Add a product</DialogTitle>
          <DialogDescription className="text-spaceAlt/90">
            Something Virtara owns, rather than work for a client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product-name" className="text-spaceText">Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pantry Pilot"
              className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
            />
          </div>

          <div>
            <Label htmlFor="product-tagline" className="text-spaceText">What is it? (optional)</Label>
            <Input
              id="product-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One line you'd use to explain it"
              className="mt-1.5 border-spaceAccent/40 bg-space1 text-spaceText placeholder:text-spaceAlt/55"
            />
          </div>

          <div>
            <Label htmlFor="product-stage" className="text-spaceText">Stage</Label>
            <select
              id="product-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ProductStage)}
              className={`mt-1.5 ${fieldClass}`}
            >
              {PRODUCT_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-spaceAlt/80">
              {PRODUCT_STAGES.find((s) => s.value === stage)?.hint}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="sm:min-w-32">
              {saving ? 'Adding…' : 'Add product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
