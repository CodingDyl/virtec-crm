'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Quote } from '@/types/quote';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingQuote, setEditingQuote] = useState<(Quote & { id: string }) | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectNames, setProjectNames] = useState<{[key: string]: string}>({});

  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "quotes"));
      const quotesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(quotesData);
      
      // Fetch project names for all quotes
      const projectNamesMap: {[key: string]: string} = {};
      for (const quote of quotesData) {
        if (quote.project_id) {
          const projectDoc = await getDoc(doc(db, "projects", quote.project_id));
          if (projectDoc.exists()) {
            projectNamesMap[quote.project_id] = projectDoc.data().clientName;
          }
        }
      }
      setProjectNames(projectNamesMap);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      await deleteDoc(doc(db, "quotes", quoteId));
      await fetchQuotes();
    } catch (error) {
      console.error("Error deleting quote:", error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingQuote?.id) return;

    try {
      const quoteRef = doc(db, "quotes", editingQuote.id);
      await updateDoc(quoteRef, {
        status: editingQuote.status
      });
      await fetchQuotes();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating quote:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Quotes Overview</CardTitle>
        <CardDescription className="text-spaceAccent">
          Manage all quotes and their statuses
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
                <TableHead className="text-spaceAlt">Date</TableHead>
                <TableHead className="text-spaceAlt">Project Name</TableHead>
                <TableHead className="text-spaceAlt">Project Type</TableHead>
                <TableHead className="text-spaceAlt">Amount</TableHead>
                <TableHead className="text-spaceAlt">Status</TableHead>
                <TableHead className="text-spaceAlt">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="text-spaceText">
                    {format(quote.created_at.toDate(), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {projectNames[quote.project_id] || 'N/A'}
                  </TableCell>
                  <TableCell className="text-spaceText">{quote.project_type}</TableCell>
                  <TableCell className="text-spaceText">
                    R{quote.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    <Badge variant={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingQuote(quote);
                        setEditDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(quote.pdf_url, '_blank')}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuote(quote.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Update Quote Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={editingQuote?.status}
              onValueChange={(value) => setEditingQuote(prev => 
                prev ? {...prev, status: value as 'pending' | 'accepted' | 'rejected'} : null
              )}
            >
              <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-space1 text-spaceText">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleUpdateStatus}
              className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
            >
              Update Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 