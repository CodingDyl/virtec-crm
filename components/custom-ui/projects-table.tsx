'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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

export default function ProjectsTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    projectType: '',
    clientName: '',
    amount: 0,
    completion: 0,
    status: ''
  });

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
      amount: project.amount,
      completion: project.completion,
      status: project.status
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
        amount: editForm.amount,
        completion: editForm.completion,
        status: status
      });
      
      await fetchProjects();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating project: ", error);
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
                  <TableHead className="text-spaceAlt">Amount</TableHead>
                  <TableHead className="text-spaceAlt">Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="hover:bg-spaceAccent cursor-pointer"
                    onClick={() => handleEditClick(project)}
                  >
                    <TableCell className="text-spaceText">{project.projectType}</TableCell>
                    <TableCell className="text-spaceText">{project.clientName}</TableCell>
                    <TableCell className="text-spaceText">
                      <Badge variant={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-spaceText">${project.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-spaceText">
                      <div className="space-y-1">
                        <span>{project.completion}%</span>
                        <Progress 
                          value={project.completion} 
                          className="h-2 bg-space1" 
                        />
                      </div>
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
              <label className="text-spaceText">Amount</label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
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
            <Button 
              onClick={handleUpdateProject}
              className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
            >
              Update Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddProjectModal onProjectAdded={fetchProjects} />
    </>
  );
}