'use client'

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Customer } from '@/types/customer';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useQuotes } from '@/contexts/DataContexts';
import { logActivity } from '@/lib/activity';
import { HealthBadges } from './HealthBadges';
import { ActivityTimeline } from './ActivityTimeline';
import { ProjectMargin } from './ProjectMargin';
import {
  CLIENT_SILENCE_BUSINESS_DAYS,
  evaluateClientSilence,
  silencePausePatch,
  SILENCE_PAUSE_REASON,
} from '@/lib/delivery-ops';

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
  const { quotes } = useQuotes();
  const silence = evaluateClientSilence(project);

  const pendingQuotes = quotes.filter(
    (q) => ((q as any).projectId ?? (q as any).project_id) === project.id && q.status === 'pending'
  ).length;

  // When a project has tasks, its completion is driven by the Tasks tab.
  const [hasTasks, setHasTasks] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'project_tasks'), where('projectId', '==', project.id)),
      (snap) => setHasTasks(snap.size > 0),
      (err) => console.error('project_tasks count error', err)
    );
    return unsub;
  }, [project.id]);

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
      const statusChanged = form.status !== project.status;
      await updateDoc(doc(db, 'projects', project.id), {
        projectType: form.projectType,
        clientId: form.clientId,
        clientName: form.clientId ? (selected?.companyName ?? form.clientName) : '',
        status: form.status,
        amount: form.amount,
        // Tasks own completion when they exist — don't clobber it from this form.
        ...(hasTasks ? {} : { completion: form.completion }),
        agreementStatus: form.agreementStatus,
      });
      await logActivity(
        'project',
        project.id,
        'update',
        statusChanged ? `Status changed to ${form.status}` : 'Project details updated'
      );
      toast.success('Project updated.');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  const markWaitingOnClient = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        waitingOnClientSince: serverTimestamp(),
      });
      await logActivity('project', project.id, 'update', 'Marked waiting on client — delivery clock started');
      toast.success('Waiting on client — clock started.');
    } catch (error) {
      console.error(error);
      toast.error('Could not start the delivery clock.');
    } finally {
      setSaving(false);
    }
  };

  const clearWaitingOnClient = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        waitingOnClientSince: null,
      });
      await logActivity('project', project.id, 'update', 'Client replied — cleared waiting-on-client clock');
      toast.success('Client reply recorded — clock cleared.');
    } catch (error) {
      console.error(error);
      toast.error('Could not clear the delivery clock.');
    } finally {
      setSaving(false);
    }
  };

  const pauseForSilence = async () => {
    setSaving(true);
    try {
      const patch = silencePausePatch();
      await updateDoc(doc(db, 'projects', project.id), {
        status: patch.status,
        pausedAt: serverTimestamp(),
        pauseReason: SILENCE_PAUSE_REASON,
      });
      setForm((prev) => ({ ...prev, status: 'on-hold' }));
      await logActivity(
        'project',
        project.id,
        'update',
        'Auto-paused after 5 business days of client silence'
      );
      toast.success('Project paused (on-hold) for client silence.');
    } catch (error) {
      console.error(error);
      toast.error('Could not pause the project.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent";

  return (
    <div className="space-y-4">
      <HealthBadges project={project} pendingQuotes={pendingQuotes} />

      <ProjectMargin project={project} />

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
            disabled={hasTasks}
            onChange={(e) => setForm((p) => ({ ...p, completion: Math.max(0, Math.min(100, Number(e.target.value))) }))}
            className="bg-space1 border-spaceAccent text-spaceText disabled:opacity-60"
          />
          {hasTasks && <p className="mt-1 text-xs text-spaceAlt/70">Synced from the Tasks tab</p>}
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

      <div className="space-y-2 rounded-lg border border-spaceAccent/20 bg-space1/40 p-3">
        <p className="text-sm font-semibold text-spaceText">Delivery clock</p>
        <p className="text-xs text-spaceAlt/80">
          Delivery Ops: after {CLIENT_SILENCE_BUSINESS_DAYS} business days of client silence on a blocker, pause the project.
        </p>
        {silence ? (
          <p className={`text-xs ${silence.silentBusinessDays >= CLIENT_SILENCE_BUSINESS_DAYS ? 'text-red-300' : 'text-orange-200'}`}>
            Waiting since {silence.waitingSince.toLocaleDateString('en-ZA')} · {silence.silentBusinessDays} business day{silence.silentBusinessDays === 1 ? '' : 's'} silent
          </p>
        ) : (
          <p className="text-xs text-spaceAlt/70">Not currently waiting on the client.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-spaceAccent/40 bg-space2 text-spaceText"
            disabled={saving || Boolean(project.waitingOnClientSince)}
            onClick={markWaitingOnClient}
          >
            Mark waiting on client
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-spaceAccent/40 bg-space2 text-spaceText"
            disabled={saving || !project.waitingOnClientSince}
            onClick={clearWaitingOnClient}
          >
            Client replied
          </Button>
          <Button
            type="button"
            className="bg-yellow-600 text-white hover:bg-yellow-700"
            disabled={saving || !silence?.shouldPause}
            onClick={pauseForSilence}
          >
            Pause for silence
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-spaceAccent hover:bg-spaceAlt text-spaceText">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>

      <div className="rounded-lg border border-spaceAccent/20 bg-space1/40 p-3">
        <p className="mb-2 text-sm font-semibold text-spaceText">Activity</p>
        <ActivityTimeline projectId={project.id} />
      </div>
    </div>
  );
}
