'use client'

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { logActivity } from '@/lib/activity';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

interface EditCustomerModalProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface EditForm {
  name: string;
  email: string;
  companyName: string;
  contactNumber: string;
  status: boolean;
  maintenance: boolean;
}

function formFrom(customer: Customer): EditForm {
  return {
    name: customer.name ?? '',
    email: customer.email ?? '',
    companyName: customer.companyName ?? '',
    contactNumber: customer.contactNumber ?? '',
    status: customer.status !== false,
    maintenance: customer.maintenance === true,
  };
}

export function EditCustomerModal({ customer, open, onOpenChange, onSaved }: EditCustomerModalProps) {
  const [form, setForm] = useState<EditForm>(() => formFrom(customer));
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the dialog opens, or a different customer is selected
  // behind it, so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (open) setForm(formFrom(customer));
  }, [open, customer.id]);

  const handleSave = async () => {
    if (!customer.id) return;

    if (!form.name.trim() && !form.companyName.trim()) {
      toast.error('Give the customer a name or a company name.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        name: form.name.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        contactNumber: form.contactNumber.trim(),
        status: form.status,
        maintenance: form.maintenance,
      });

      const statusChanged = form.status !== (customer.status !== false);
      await logActivity(
        'customer',
        customer.id,
        'update',
        statusChanged
          ? `Customer marked ${form.status ? 'active' : 'inactive'}`
          : 'Customer details updated'
      );

      toast.success('Customer updated.');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update the customer. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-space2 border-spaceAccent">
        <DialogHeader>
          <DialogTitle className="text-spaceText">Edit customer</DialogTitle>
          <DialogDescription className="text-spaceAlt">
            Changes apply everywhere this customer appears — projects, quotes and invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-customer-name" className="text-spaceText">Contact name</Label>
              <Input
                id="edit-customer-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <Label htmlFor="edit-customer-company" className="text-spaceText">Company name</Label>
              <Input
                id="edit-customer-company"
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                className="mt-1 bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-customer-email" className="text-spaceText">Email</Label>
              <Input
                id="edit-customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <Label htmlFor="edit-customer-contact" className="text-spaceText">Contact number</Label>
              <Input
                id="edit-customer-contact"
                value={form.contactNumber}
                onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
                className="mt-1 bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-customer-status" className="text-spaceText">Status</Label>
            <select
              id="edit-customer-status"
              value={form.status ? 'true' : 'false'}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value === 'true' }))}
              className={`mt-1 ${selectClass}`}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-spaceAccent/25 bg-space1/50 p-3">
            <Checkbox
              id="edit-customer-maintenance"
              checked={form.maintenance}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, maintenance: checked === true }))}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-spaceText">Maintenance customer</span>
              <span className="block text-xs text-spaceAlt/80">
                Makes them selectable when generating maintenance invoices.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-spaceAccent/40 bg-space1 text-spaceText hover:bg-space1/70"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-spaceAccent hover:bg-spaceAlt text-space1 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
