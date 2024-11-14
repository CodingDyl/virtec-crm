'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProjectModal } from "./add-project-modal";
import { Progress } from "@/components/ui/progress";
import { Quote } from '@/types/quote';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/firebaseConfig';
import { toast } from 'react-toastify';

export default function ProjectsTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    projectType: '',
    clientName: '',
    completion: 0,
    status: '',
    agreementStatus: ''
  });
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "projects"));
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setEditForm({
      projectType: project.projectType,
      clientName: project.clientName,
      completion: project.completion,
      status: project.status,
      agreementStatus: project.agreementStatus || 'pending'
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;

    try {
      const projectRef = doc(db, "projects", editingProject.id);
      const status = editForm.completion === 100 ? 'completed' : 'active';
      
      await updateDoc(projectRef, {
        projectType: editForm.projectType,
        clientName: editForm.clientName,
        completion: editForm.completion,
        status: status,
        quoteId: editingProject.quoteId,
        agreementStatus: editForm.agreementStatus
      });
      
      await fetchProjects();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating project: ", error);
    }
  };

  const fetchProjectWithQuote = async (project: Project) => {
    if (project.quoteId) {
      try {
        const quoteDoc = await getDoc(doc(db, "quotes", project.quoteId));
        
        if (quoteDoc.exists()) {
          const quoteData = quoteDoc.data() as Quote;
          setSelectedQuote(quoteData);
          setQuoteDialogOpen(true);
        }
      } catch (error) {
        console.error("Error fetching quote:", error);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on-hold': return 'outline';
      default: return 'default';
    }
  };

  const getAgreementStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved': return 'success';
      case 'declined': return 'destructive';
      case 'pending': return 'warning';
      default: return 'default';
    };
  };

  const handleUploadSignedAgreement = async (project: Project) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const storageRef = ref(storage, `agreements/${project.id}_signed_agreement.pdf`);
        await uploadBytes(storageRef, file);
        const pdfUrl = await getDownloadURL(storageRef);

        const projectRef = doc(db, "projects", project.id);
        await updateDoc(projectRef, {
          agreementUrl: pdfUrl,
          agreementStatus: 'signed'
        });

        await fetchProjects();
        toast.success("Signed agreement uploaded successfully!");
      } catch (error) {
        console.error("Error uploading signed agreement:", error);
        toast.error("Failed to upload signed agreement");
      }
    };

    input.click();
  };

  const handleAgreementClick = (project: Project) => {
    setSelectedProject(project);
    setAgreementDialogOpen(true);
  };

  const handleDeleteAgreement = async (projectId: string) => {
    try {
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        agreementUrl: null,
        agreementStatus: null
      });
      await fetchProjects();
      setAgreementDialogOpen(false);
      toast.success("Agreement deleted successfully!");
    } catch (error) {
      console.error("Error deleting agreement:", error);
      toast.error("Failed to delete agreement");
    }
  };

  return (
    <>
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader>
          <CardTitle className="text-spaceText">Projects Overview</CardTitle>
          <CardDescription className="text-spaceAccent">
            A list of all projects and their current status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spaceText"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-spaceAlt">Project Type</TableHead>
                  <TableHead className="text-spaceAlt">Client</TableHead>
                  <TableHead className="text-spaceAlt">Status</TableHead>
                  <TableHead className="text-spaceAlt">Quote</TableHead>
                  <TableHead className="text-spaceAlt">Completion</TableHead>
                  <TableHead className="text-spaceAlt">Agreement</TableHead>
                  <TableHead className="text-spaceAlt">Agreement Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="hover:bg-spaceAlt cursor-pointer"
                    onClick={() => handleEditClick(project)}
                  >
                    <TableCell className="text-spaceText">{project.projectType}</TableCell>
                    <TableCell className="text-spaceText">{project.clientName}</TableCell>
                    <TableCell className="text-spaceText">
                      <Badge variant={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-spaceText">
                      {project.quoteId ? (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchProjectWithQuote(project);
                          }}
                          variant="default"
                          className="bg-spaceAccent hover:bg-space1 text-spaceText"
                          size="sm"
                        >
                          View Quote
                        </Button>
                      ) : (
                        <span className="text-gray-400">No Quote Found</span>
                      )}
                    </TableCell>
                    <TableCell className="text-spaceText">
                      <div className="space-y-1">
                        <span>{project.completion}%</span>
                        <Progress value={project.completion} className="h-2 bg-space1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-spaceText">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAgreementClick(project);
                        }}
                        variant="default"
                        className="bg-spaceAccent hover:bg-space1 text-spaceText"
                        size="sm"
                      >
                        Manage Agreement
                      </Button>
                    </TableCell>
                    <TableCell className="text-spaceText">
                      {/* @ts-ignore */}
                      <Badge variant={getAgreementStatusColor(project.agreementStatus)}>
                        {project.agreementStatus || 'pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-spaceText">Project Type</label>
              <Input
                value={editForm.projectType}
                onChange={(e) => setEditForm(prev => ({ ...prev, projectType: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Client Name</label>
              <Input
                value={editForm.clientName}
                onChange={(e) => setEditForm(prev => ({ ...prev, clientName: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Completion (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editForm.completion}
                onChange={(e) => setEditForm(prev => ({ ...prev, completion: Number(e.target.value) }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Agreement Status</label>
              <select
                value={editForm.agreementStatus}
                onChange={(e) => setEditForm(prev => ({ ...prev, agreementStatus: e.target.value }))}
                className="w-full bg-space1 border-spaceAccent text-spaceText rounded-md p-2"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <Button 
              onClick={handleUpdateProject}
              className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
            >
              Update Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Quote Details</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="text-spaceText">
                <p>Amount: R{selectedQuote.total_amount?.toLocaleString()}</p>
                <p>Status: {selectedQuote.status}</p>
                <p>Created: {selectedQuote.created_at?.toDate().toUTCString()}</p>
              </div>
              <Button
                onClick={() => window.open(selectedQuote.pdf_url, '_blank')}
                className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
              >
                Download Quote PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={agreementDialogOpen} onOpenChange={setAgreementDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Agreement Options</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <Button
                onClick={() => window.open(selectedProject.agreementUrl, '_blank')}
                className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
              >
                View Agreement
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUploadSignedAgreement(selectedProject);
                }}
                variant="outline"
                className="border-spaceAccent bg-space1 text-spaceText w-full"
              >
                Update Agreement
              </Button>
              <Button
                onClick={() => handleDeleteAgreement(selectedProject.id)}
                variant="destructive"
                className="w-full"
              >
                Delete Agreement
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddProjectModal onProjectAdded={fetchProjects} />

    </>
  );
}