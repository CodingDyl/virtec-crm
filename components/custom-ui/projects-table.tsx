'use client'

import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, updateDoc, getDoc, deleteDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { deleteFiles, openStoredFile } from '@/lib/storage-client';
import { documentFileRef, quoteFileRef } from '@/lib/firestore-schema';
import { Project } from '@/types/project';
import { Quote } from '@/types/quote';
import { BusinessDocument, DOCUMENT_TYPE_LABELS } from '@/types/document';
import { useProjects, useCustomers } from '@/contexts/DataContexts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProjectModal } from "./add-project-modal";
import { UploadDocumentModal } from "./upload-document-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "./table-pagination";
import { toast } from 'sonner';
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { Search, FileText, Trash2, ExternalLink } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'completed' | 'on-hold';
type AgreementFilter = 'all' | 'signed' | 'approved' | 'pending' | 'declined' | 'none';

export default function ProjectsTable() {
  const { projects, isLoading } = useProjects();
  const { customers } = useCustomers();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agreementFilter, setAgreementFilter] = useState<AgreementFilter>('all');

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    projectType: '',
    clientId: '',
    clientName: '',
    completion: 0,
    status: 'active',
    amount: 0,
    agreementStatus: 'pending' as string,
  });

  const [projectDocuments, setProjectDocuments] = useState<BusinessDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<BusinessDocument | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return projects.filter((project) => {
      const text = `${project.projectType} ${project.clientName}`.toLowerCase();
      const matchesSearch = text.includes(term);
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const agreement = project.agreementStatus ?? (project.agreementUrl ? 'signed' : 'none');
      const matchesAgreement =
        agreementFilter === 'all' ||
        (agreementFilter === 'none' && !project.agreementUrl && !project.agreementStatus) ||
        agreement === agreementFilter;
      return matchesSearch && matchesStatus && matchesAgreement;
    });
  }, [projects, searchTerm, statusFilter, agreementFilter]);

  const {
    page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end,
  } = usePagination(filteredProjects, { resetKey: `${searchTerm}|${statusFilter}|${agreementFilter}` });

  const fetchProjectDocuments = async (projectId: string) => {
    setDocsLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'documents'), where('linkedId', '==', projectId))
      );
      setProjectDocuments(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BusinessDocument[]
      );
    } catch (error) {
      console.error('Error fetching documents:', error);
      setProjectDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setEditForm({
      projectType: project.projectType,
      clientId: project.clientId ?? '',
      clientName: project.clientName ?? '',
      completion: project.completion ?? 0,
      status: project.status ?? 'active',
      amount: project.amount ?? 0,
      agreementStatus: project.agreementStatus ?? 'pending',
    });
    setEditDialogOpen(true);
    fetchProjectDocuments(project.id);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    setBusy(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === editForm.clientId);
      await updateDoc(doc(db, "projects", editingProject.id), {
        projectType: editForm.projectType,
        clientId: editForm.clientId,
        clientName: selectedCustomer?.companyName ?? editForm.clientName,
        completion: editForm.completion,
        status: editForm.status,
        amount: editForm.amount,
        agreementStatus: editForm.agreementStatus,
      });
      toast.success('Project updated.');
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating project: ", error);
      toast.error('Failed to update project.');
    } finally {
      setBusy(false);
    }
  };

  const fetchProjectWithQuote = async (project: Project) => {
    if (!project.quoteId) return;
    try {
      const quoteDoc = await getDoc(doc(db, "quotes", project.quoteId));
      if (quoteDoc.exists()) {
        setSelectedQuote({ id: quoteDoc.id, ...quoteDoc.data() } as Quote);
        setQuoteDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      // Clean up linked documents (files + records) and the signed agreement.
      const docsSnap = await getDocs(
        query(collection(db, 'documents'), where('linkedId', '==', deleteTarget.id))
      );
      await deleteFiles([
        deleteTarget.agreementPath,
        ...docsSnap.docs.map((d) => (d.data() as BusinessDocument).storagePath),
      ]);
      await Promise.all(docsSnap.docs.map((d) => deleteDoc(doc(db, 'documents', d.id))));

      await deleteDoc(doc(db, 'projects', deleteTarget.id));
      toast.success('Project deleted.');
      setDeleteTarget(null);
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocTarget) return;
    setBusy(true);
    try {
      await deleteFiles([deleteDocTarget.storagePath]);
      await deleteDoc(doc(db, 'documents', deleteDocTarget.id));
      if (deleteDocTarget.type === 'agreement' && editingProject) {
        await updateDoc(doc(db, 'projects', editingProject.id), {
          agreementUrl: null, agreementPath: null, agreementStatus: null,
        });
      }
      toast.success('Document removed.');
      setDeleteDocTarget(null);
      if (editingProject) fetchProjectDocuments(editingProject.id);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to remove document.');
    } finally {
      setBusy(false);
    }
  };

  const getStatusColorStatus = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500 hover:bg-blue-600';
      case 'on-hold': return 'bg-gray-500 hover:bg-gray-600';
      case 'completed': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const getAgreementStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'signed':
      case 'approved': return 'bg-green-500 hover:bg-green-600';
      case 'declined': return 'bg-red-500 hover:bg-red-600';
      case 'pending': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return 'bg-yellow-500 hover:bg-yellow-600';
    }
  };

  return (
    <>
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-spaceText">Projects Overview</CardTitle>
              <CardDescription className="text-spaceAccent">
                {filteredProjects.length} of {projects.length} projects
              </CardDescription>
            </div>
            <AddProjectModal onProjectAdded={() => { /* realtime context refreshes automatically */ }} />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spaceAlt/80" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project type or client"
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-10 rounded-xl border border-spaceAccent/35 bg-space1/85 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </select>
            <select
              value={agreementFilter}
              onChange={(e) => setAgreementFilter(e.target.value as AgreementFilter)}
              className="h-10 rounded-xl border border-spaceAccent/35 bg-space1/85 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
            >
              <option value="all">All agreements</option>
              <option value="signed">Signed</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
              <option value="none">No agreement</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="min-h-[500px] w-full flex flex-col items-center justify-center p-8 gap-4">
              <Quantum size="100" speed="1.75" color="white" />
              <p className="text-spaceText">Fetching projects...</p>
            </div>
          ) : (
            <div className="rounded-xl border border-spaceAccent/25 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-spaceAlt">Project Type</TableHead>
                    <TableHead className="text-spaceAlt">Client</TableHead>
                    <TableHead className="text-spaceAlt">Status</TableHead>
                    <TableHead className="text-spaceAlt">Amount</TableHead>
                    <TableHead className="text-spaceAlt">Quote</TableHead>
                    <TableHead className="text-spaceAlt">Completion</TableHead>
                    <TableHead className="text-spaceAlt">Agreement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-spaceAlt">
                        No projects match your current search/filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-space1/70"
                        onClick={() => handleEditClick(project)}
                      >
                        <TableCell className="text-spaceText">{project.projectType}</TableCell>
                        <TableCell className="text-spaceText">{project.clientName}</TableCell>
                        <TableCell>
                          <Badge className={`text-white capitalize ${getStatusColorStatus(project.status)}`}>
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-spaceText">
                          {project.amount ? `R ${project.amount.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          {project.quoteId ? (
                            <Button
                              onClick={(e) => { e.stopPropagation(); fetchProjectWithQuote(project); }}
                              className="bg-spaceAccent hover:bg-space1 text-spaceText"
                              size="sm"
                            >
                              View Quote
                            </Button>
                          ) : (
                            <span className="text-spaceAlt/70 text-sm">No quote</span>
                          )}
                        </TableCell>
                        <TableCell className="text-spaceText">
                          <div className="space-y-1 min-w-[90px]">
                            <span className="text-sm">{project.completion}%</span>
                            <Progress value={project.completion} className="h-2 bg-space1" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-white capitalize ${getAgreementStatusColor(project.agreementStatus)}`}>
                            {project.agreementStatus || (project.agreementUrl ? 'signed' : 'pending')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {total > 0 && (
                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  start={start}
                  end={end}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="projects"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / manage project */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-spaceText text-sm">Project Type</label>
              <Input
                value={editForm.projectType}
                onChange={(e) => setEditForm((prev) => ({ ...prev, projectType: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>

            <div>
              <label className="text-spaceText text-sm">Client</label>
              <select
                value={editForm.clientId}
                onChange={(e) => setEditForm((prev) => ({ ...prev, clientId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
              >
                <option value="">
                  {editForm.clientName ? `${editForm.clientName} (unlinked)` : 'Select a client'}
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.companyName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-spaceText text-sm">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="text-spaceText text-sm">Amount (R)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, '')) : 0 }))}
                  className="bg-space1 border-spaceAccent text-spaceText"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-spaceText text-sm">Completion (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.completion}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, completion: Number(e.target.value) }))}
                  className="bg-space1 border-spaceAccent text-spaceText"
                />
              </div>
              <div>
                <label className="text-spaceText text-sm">Agreement Status</label>
                <select
                  value={editForm.agreementStatus}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, agreementStatus: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
                >
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            </div>

            {/* Documents section */}
            <div className="rounded-lg border border-spaceAccent/30 bg-space1/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-spaceText text-sm font-medium">Documents</p>
                {editingProject && (
                  <UploadDocumentModal
                    project={editingProject}
                    onUploaded={() => fetchProjectDocuments(editingProject.id)}
                  />
                )}
              </div>
              {docsLoading ? (
                <p className="text-spaceAlt/70 text-sm py-2">Loading documents…</p>
              ) : projectDocuments.length === 0 ? (
                <p className="text-spaceAlt/70 text-sm py-2">
                  No uploaded documents yet. Use “Upload Document” to add a quote, letter, or agreement.
                </p>
              ) : (
                <ul className="space-y-2">
                  {projectDocuments.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-space2/70 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-spaceAccent" />
                        <span className="truncate text-sm text-spaceText">{d.name}</span>
                        <Badge variant="secondary" className="shrink-0 capitalize">{DOCUMENT_TYPE_LABELS[d.type]}</Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="text-spaceAccent hover:text-spaceText"
                          onClick={() => openStoredFile(documentFileRef(d)).catch(() => toast.error('Could not open the document.'))}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300"
                          onClick={() => setDeleteDocTarget(d)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleUpdateProject}
                disabled={busy}
                className="flex-1 bg-spaceAccent hover:bg-spaceAlt text-spaceText"
              >
                Update Project
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteTarget(editingProject)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quote details */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Quote Details</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="text-spaceText space-y-1">
                <p>Amount: R{pickNumber(selectedQuote as any, ["totalAmount", "total_amount"], 0).toLocaleString()}</p>
                <p>Status: {selectedQuote.status}</p>
                <p>Created: {(toDate((selectedQuote as any).createdAt ?? selectedQuote.created_at) ?? new Date()).toUTCString()}</p>
              </div>
              <Button
                onClick={() => openStoredFile(quoteFileRef(selectedQuote as any)).catch(() => toast.error('Could not open the quote.'))}
                className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
              >
                Download Quote PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete project?"
        description={
          <>This permanently deletes <span className="text-spaceText">{deleteTarget?.projectType}</span> for {deleteTarget?.clientName}, along with its uploaded documents. This cannot be undone.</>
        }
        confirmLabel="Delete project"
        destructive
        loading={busy}
        onConfirm={handleDeleteProject}
      />

      <ConfirmDialog
        open={!!deleteDocTarget}
        onOpenChange={(o) => !o && setDeleteDocTarget(null)}
        title="Remove document?"
        description={<>Remove <span className="text-spaceText">{deleteDocTarget?.name}</span> from this project?</>}
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={handleDeleteDocument}
      />
    </>
  );
}
