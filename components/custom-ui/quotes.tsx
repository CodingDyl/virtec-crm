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
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/firebase/firebaseConfig';
import { useQuotes } from '@/contexts/DataContexts';
import { Quantum } from 'ldrs/react';
import { pickNumber, toDate } from '@/lib/firestore-schema';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from './table-pagination';

export default function Quotes() {
  const { quotes, isLoading, projectNames, lastUpdated, refreshData } = useQuotes();
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const {
    page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end,
  } = usePagination(quotes, { resetKey: quotes.length });

  const getLastUpdatedText = () => {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return lastUpdated.toLocaleDateString();
  };

  const calculateTotalQuotes = () => {
    return quotes.length;
  };

  const calculateAcceptedQuotes = () => {
    return quotes.filter(quote => quote.status === 'accepted').length;
  };

  const calculatePendingQuotes = () => {
    return quotes.filter(quote => quote.status === 'pending').length;
  };

  const calculateRejectedQuotes = () => {
    return quotes.filter(quote => quote.status === 'rejected').length;
  };

  const calculateTotalValue = () => {
    return quotes.reduce((sum, quote) => sum + pickNumber(quote as any, ["totalAmount", "total_amount"], 0), 0);
  };

  const calculateAcceptedValue = () => {
    return quotes
      .filter(quote => quote.status === 'accepted')
      .reduce((sum, quote) => sum + pickNumber(quote as any, ["totalAmount", "total_amount"], 0), 0);
  };

  const calculatePendingValue = () => {
    return quotes
      .filter(quote => quote.status === 'pending')
      .reduce((sum, quote) => sum + pickNumber(quote as any, ["totalAmount", "total_amount"], 0), 0);
  };

  const handleDeleteQuote = async (quoteId: string, pdfUrl: string) => {
    try {
      // Create a reference to the file to delete
      const pdfRef = ref(storage, pdfUrl);

      // Delete the file
      await deleteObject(pdfRef);

      // Delete the quote document
      await deleteDoc(doc(db, "quotes", quoteId));

      await refreshData();
    } catch (error) {
      console.error("Error deleting quote or PDF:", error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingQuote?.id) return;

    try {
      const quoteRef = doc(db, "quotes", editingQuote.id);
      await updateDoc(quoteRef, {
        status: editingQuote.status
      });
      await refreshData();
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
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-spaceText">Quotes Overview</CardTitle>
            <CardDescription className="text-spaceAccent">
              Last updated: {getLastUpdatedText()}
            </CardDescription>
          </div>
          <Button 
            onClick={refreshData}
            className="bg-spaceAccent hover:bg-spaceAlt text-spaceText"
          >
            Refresh Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Section */}
        <div className="rounded-lg border border-spaceAccent bg-space1 p-6">
          <h3 className="text-lg font-semibold text-spaceText mb-4">Quotes Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Total Quotes</p>
                  <p className="text-2xl font-bold text-spaceText">{calculateTotalQuotes()}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Accepted Quotes</p>
                  <p className="text-2xl font-bold text-green-500">{calculateAcceptedQuotes()}</p>
                  <p className="text-sm text-green-500/70">R{calculateAcceptedValue().toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Pending Quotes</p>
                  <p className="text-2xl font-bold text-yellow-500">{calculatePendingQuotes()}</p>
                  <p className="text-sm text-yellow-500/70">R{calculatePendingValue().toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Rejected Quotes</p>
                  <p className="text-2xl font-bold text-red-500">{calculateRejectedQuotes()}</p>
                </div>
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Total Value</p>
                  <p className="text-2xl font-bold text-blue-500">R{calculateTotalValue().toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-space2 rounded-lg p-4 border border-spaceAccent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-spaceText/70 font-medium">Acceptance Rate</p>
                  <p className="text-2xl font-bold text-green-500">
                    {calculateTotalQuotes() > 0 
                      ? `${Math.round((calculateAcceptedQuotes() / calculateTotalQuotes()) * 100)}%`
                      : '0%'
                    }
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {calculatePendingQuotes() > 0 && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-yellow-500 font-medium">
                  You have <span className="font-bold">{calculatePendingQuotes()}</span> pending quotes worth <span className="font-bold">R{calculatePendingValue().toLocaleString()}</span> awaiting client response.
                </p>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="min-h-[500px] w-full flex flex-col items-center justify-center p-8 gap-4">
          <Quantum
            size="100"
            speed="1.75"
            color="white" 
          />
          <p className="text-spaceText">Fetching quotes...</p>
        </div>
        ) : (
          <div className="rounded-md border border-spaceAccent/25 overflow-hidden">
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
              {pageItems.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="text-spaceText">
                    {format(toDate((quote as any).createdAt ?? quote.created_at) ?? new Date(), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {projectNames[(quote as any).projectId ?? quote.project_id] || 'N/A'}
                  </TableCell>
                  <TableCell className="text-spaceText">{(quote as any).projectType ?? quote.project_type}</TableCell>
                  <TableCell className="text-spaceText">
                    R{pickNumber(quote as any, ["totalAmount", "total_amount"], 0).toLocaleString()}
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
                      onClick={() => window.open((quote as any).pdfUrl ?? quote.pdf_url, '_blank')}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuote(quote.id, (quote as any).pdfUrl ?? quote.pdf_url)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
              itemLabel="quotes"
            />
          )}
          </div>
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
