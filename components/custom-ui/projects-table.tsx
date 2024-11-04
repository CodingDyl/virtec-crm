'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { projects } from "@/constants";
import { AddProjectModal } from "./add-project-modal";

export default function ProjectsTable() {
  return (
    <>
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader>
          <CardTitle className="text-spaceText">Project Overview</CardTitle>
          <CardDescription className="text-spaceAccent">
            A list of all current projects and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-spaceAlt">Project Type</TableHead>
                <TableHead className="text-spaceAlt">Client</TableHead>
                <TableHead className="text-spaceAlt">Status</TableHead>
                <TableHead className="text-spaceAlt">Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.name} className="hover:bg-spaceAccent">
                  <TableCell className="text-spaceText">{project.name}</TableCell>
                  <TableCell className="text-spaceText">{project.client}</TableCell>
                  <TableCell className="text-spaceText">
                    <Badge variant={project.status === 'Completed' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-spaceText">
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-space1 h-2.5 rounded-full"
                        style={{ width: `${project.completion}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-400">{project.completion}%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddProjectModal />
    </>
  );
}