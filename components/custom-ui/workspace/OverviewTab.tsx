'use client'

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from 'react-toastify';

interface OverviewTabProps {
  project: Project;
  customers: Customer[];
}

export function OverviewTab({ project, customers }: OverviewTabProps) {
  const [form, setForm] = useState<{
    projectType: string;
    clientId: string;
    clientName: string;
    status: string;
    amount: number;
    completion: number;
    agreementStatus: Project['agreementStatus'];
  }>({
    projectType: project.projectType,
    clientId: project.clientId ?? '',
    clientName: project.clientName ?? '',
    status: project.status ?? 'active',
    amount: project.amount ?? 0,
    completion: project.completion ?? 0,
    agreementStatus: project.agreementStatus ?? 'pending',
  });
  const [saving, setSaving] = useState(false);

  // Re-sync the form whenever a different project is selected.
  useEffect(() => {
    setForm({
      projectType: project.projectType,
      clientId: project.clientId ?? '',
      clientName: project.clientName ?? '',
      status: project.status ?? 'active',
      amount: project.amount ?? 0,
      completion: project.completion ?? 0,
      agreementStatus: project.agreementStatus ?? 'pending',
    });
  }, [project.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const selected = customers.find((c) => c.id === form.clientId);
      await updateDoc(doc(db, 'projects', project.id), {
        projectType: form.projectType,
        clientId: form.clientId,
        clientName: selected?.companyName ?? form.clientName,
        status: form.status,
        amount: form.amount,
        completion: form.completion,
        agreementStatus: form.agreementStatus,
      });
      toast.success('Project updated.');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-spaceText">Project Type</label>
        <Input
          value={form.projectType}
          onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))}
          className="bg-space1 border-spaceAccent text-spaceText"
        />
      </div>

      <div>
        <label className="text-sm text-spaceText">Client</label>
        <select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} className={selectClass}>
          <option value="">{form.clientName ? `${form.clientName} (unlinked)` : 'Select a client'}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-spaceText">Status</label>
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={selectClass}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-spaceText">Amount (R)</label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, '')) : 0 }))}
            className="bg-space1 border-spaceAccent text-spaceText"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-spaceText">Completion (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={form.completion}
            onChange={(e) => setForm((p) => ({ ...p, completion: Number(e.target.value) }))}
            className="bg-space1 border-spaceAccent text-spaceText"
          />
        </div>
        <div>
          <label className="text-sm text-spaceText">Agreement Status</label>
          <select value={form.agreementStatus} onChange={(e) => setForm((p) => ({ ...p, agreementStatus: e.target.value as Project['agreementStatus'] }))} className={selectClass}>
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-spaceAccent hover:bg-spaceAlt text-spaceText">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
