import { useMemo, useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { openStoredFile } from '@/lib/storage-client'
import { useCustomers, useMaintenanceInvoices, useProjects } from '@/contexts/DataContexts'
import { MaintenanceInvoice } from '@/types/maintenance'
import { invoiceLabel, resolveInvoiceClientId } from '@/lib/maintenance'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from 'date-fns'
import { toast } from "sonner"
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import { usePagination } from '@/hooks/use-pagination'
import { TablePagination } from './table-pagination'

type MaintenanceItem = MaintenanceInvoice['items'][number];

export default function MaintenanceTable() {
  const { invoices, isLoading } = useMaintenanceInvoices();
  const { customers } = useCustomers();
  const { projects } = useProjects();
  const [updatingInvoice, setUpdatingInvoice] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<MaintenanceInvoice | null>(null);
  const [emailForm, setEmailForm] = useState({
    toEmail: '',
    ccEmail: '',
    subject: '',
    message: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  const {
    page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end,
  } = usePagination(invoices, { resetKey: invoices.length });

  const clients = useMemo(() => {
    const map: Record<string, { name: string; companyName: string; email: string }> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = { name: c.name, companyName: c.companyName, email: c.email };
    });
    return map;
  }, [customers]);

  /** Which maintenance project each invoice bills against, where one is linked. */
  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.id] = p.projectType || 'Project'; });
    return map;
  }, [projects]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const resolvedClientLabel = (invoice: MaintenanceInvoice) => {
    const clientId = resolveInvoiceClientId(invoice, projectsById, customers);
    if (clientId && clients[clientId]) {
      return clients[clientId].companyName || clients[clientId].name;
    }
    const legacyName = (invoice as MaintenanceInvoice & { clientName?: string }).clientName;
    if (legacyName && legacyName.trim()) return legacyName.trim();
    return 'Unknown Client';
  };

  const setStatus = (status: string) => {
    if (status === 'paid') {
      return 'Paid';
    } else if (status === 'emailed') {
      return 'Emailed';
    } else if (status === 'overdue') {
      return 'Overdue';
    } else {
      return 'Pending';
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-500';
      case 'emailed':
        return 'text-blue-500';
      case 'overdue':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'MMM dd, yyyy');
  };

  const calculateTotalHours = (items: MaintenanceItem[]) => {
    return items.reduce((sum, item) => sum + item.hours, 0);
  };

  const calculateOutstandingAmount = () => {
    return invoices
      .filter(invoice => invoice.status === 'pending' || invoice.status === 'emailed')
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  };

  const calculateTotalInvoices = () => {
    return invoices.length;
  };

  const calculatePaidInvoices = () => {
    return invoices.filter(invoice => invoice.status === 'paid').length;
  };

  const calculatePendingInvoices = () => {
    return invoices.filter(invoice => invoice.status === 'pending').length;
  };

  const calculateEmailedInvoices = () => {
    return invoices.filter(invoice => invoice.status === 'emailed').length;
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    setUpdatingInvoice(invoiceId);
    try {
      const invoiceRef = doc(db, "maintenance_invoices", invoiceId);
      await updateDoc(invoiceRef, {
        status: 'paid'
      });

      toast.success("Invoice marked as paid successfully!");
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast.error("Failed to mark invoice as paid. Please try again.");
    } finally {
      setUpdatingInvoice(null);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      const invoiceRef = doc(db, "maintenance_invoices", invoiceId);
      await deleteDoc(invoiceRef);
      toast.success("Invoice deleted successfully!");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice. Please try again.");
    }
  };

  const handleSendEmail = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    const client = clients[invoice.clientId];
    if (!client) return;
    
    setSelectedInvoice(invoice);
    const label = invoiceLabel(invoice);
    
    // Different message for re-sending vs first time
    const isResending = invoice.status === 'emailed';
    const message = isResending 
      ? `Dear ${client.name},\n\nPlease find attached maintenance invoice ${label} for ${format(invoice.date.toDate(), 'MMMM dd, yyyy')}.\n\nTotal Amount: R${invoice.totalAmount.toLocaleString()}\n\nIf you have already received this invoice, please disregard this duplicate.\n\nThank you for your business.\n\nBest regards,\nVirtara Team`
      : `Dear ${client.name},\n\nPlease find attached maintenance invoice ${label} for ${format(invoice.date.toDate(), 'MMMM dd, yyyy')}.\n\nTotal Amount: R${invoice.totalAmount.toLocaleString()}\n\nThank you for your business.\n\nBest regards,\nVirtara Team`;
    
    setEmailForm({
      toEmail: client.email,
      ccEmail: '',
      subject: `Invoice ${label} - ${format(invoice.date.toDate(), 'MMM dd, yyyy')}`,
      message: message
    });
    setEmailModalOpen(true);
  };

  const handleSubmitEmail = async () => {
    if (!selectedInvoice) return;
    
    // Validate required fields
    if (!emailForm.toEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    
    if (!emailForm.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    
    if (!emailForm.message.trim()) {
      toast.error("Message is required");
      return;
    }
    
    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: emailForm.toEmail.trim(),
          ccEmail: emailForm.ccEmail.trim(),
          subject: emailForm.subject.trim(),
          message: emailForm.message.trim(),
          invoiceId: selectedInvoice.id,
          invoiceNumber: invoiceLabel(selectedInvoice),
          pdfPath: selectedInvoice.pdfPath || selectedInvoice.pdfUrl,
          clientName: clients[selectedInvoice.clientId]?.name || 'Unknown Client'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      // Update invoice status to emailed
      const invoiceRef = doc(db, "maintenance_invoices", selectedInvoice.id);
      await updateDoc(invoiceRef, {
        status: 'emailed'
      });

      setEmailModalOpen(false);
      setSelectedInvoice(null);
      setEmailForm({
        toEmail: '',
        ccEmail: '',
        subject: '',
        message: ''
      });
      
      toast.success("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 gap-4">
        <Quantum
          size="100"
          speed="1.75"
          color="white" 
        />
        <p className="text-spaceText">Loading maintenance invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="rounded-lg border border-spaceAccent bg-space2 p-6">
        <h3 className="text-lg font-semibold text-spaceText mb-4">Maintenance Invoices Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-space1 rounded-lg p-4 border border-spaceAccent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70 font-medium">Total Invoices</p>
                <p className="text-2xl font-bold text-spaceText">{calculateTotalInvoices()}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-space1 rounded-lg p-4 border border-spaceAccent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70 font-medium">Paid Invoices</p>
                <p className="text-2xl font-bold text-green-500">{calculatePaidInvoices()}</p>
              </div>
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-space1 rounded-lg p-4 border border-spaceAccent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70 font-medium">Pending Invoices</p>
                <p className="text-2xl font-bold text-yellow-500">{calculatePendingInvoices()}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-space1 rounded-lg p-4 border border-spaceAccent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70 font-medium">Emailed Invoices</p>
                <p className="text-2xl font-bold text-blue-500">{calculateEmailedInvoices()}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-space1 rounded-lg p-4 border border-spaceAccent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70 font-medium">Outstanding Amount</p>
                <p className="text-2xl font-bold text-red-500">R{calculateOutstandingAmount().toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {calculateOutstandingAmount() > 0 && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-500 font-medium">
                You have <span className="font-bold">R{calculateOutstandingAmount().toLocaleString()}</span> in outstanding maintenance invoices that require attention.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md border border-spaceAccent">
        <Table>
          <TableHeader>
            <TableRow className="bg-space2">
              <TableHead className="text-spaceText">Invoice #</TableHead>
              <TableHead className="text-spaceText">Date</TableHead>
              <TableHead className="text-spaceText">Client</TableHead>
              <TableHead className="text-spaceText">Project</TableHead>
              <TableHead className="text-spaceText">Email</TableHead>
              <TableHead className="text-spaceText">Items</TableHead>
              <TableHead className="text-spaceText">Hours</TableHead>
              <TableHead className="text-spaceText">Amount</TableHead>
              <TableHead className="text-spaceText">Status</TableHead>
              <TableHead className="text-spaceText">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-spaceText py-8">
                  No maintenance invoices found
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-space1">
                  <TableCell className="text-spaceText font-medium">
                    {invoiceLabel(invoice)}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {formatDate(invoice.date)}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {resolvedClientLabel(invoice)}
                  </TableCell>
                  <TableCell>
                    {invoice.projectId && projectNames[invoice.projectId] ? (
                      <span className="text-spaceText">{projectNames[invoice.projectId]}</span>
                    ) : (
                      <span className="text-yellow-500/90" title="Not billed against a maintenance project">
                        Unlinked
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {clients[invoice.clientId]?.email || 'Unknown Email'}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {invoice.items.length} items
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {calculateTotalHours(invoice.items)}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    R{invoice.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`${getStatusColor(invoice.status)} capitalize`}>
                      {setStatus(invoice.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
                        onClick={() => openStoredFile(invoice.pdfPath || invoice.pdfUrl).catch(() => toast.error('Could not open the invoice.'))}
                      >
                        View PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={invoice.status === 'paid' 
                          ? "bg-green-600 text-white hover:bg-green-700" 
                          : "bg-spaceAccent text-space1 hover:bg-spaceAlt"}
                        onClick={() => handleMarkAsPaid(invoice.id)}
                        disabled={invoice.status === 'paid' || updatingInvoice === invoice.id}
                      >
                        {updatingInvoice === invoice.id ? "Updating..." : 
                         invoice.status === 'paid' ? "Paid" : "Mark as Paid"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={invoice.status === 'paid' ? "hidden" : "bg-red-600 text-white hover:bg-red-700"}
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        disabled={invoice.status === 'paid'}
                      >
                        {invoice.status === 'paid' ? "" : "Delete Invoice"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={invoice.status === 'paid' ? "hidden" : 
                                 invoice.status === 'emailed' ? "bg-blue-600 text-white hover:bg-blue-700" : 
                                 "bg-spaceAccent text-space1 hover:bg-spaceAlt"}
                        onClick={() => handleSendEmail(invoice.id)}
                        disabled={invoice.status === 'paid' || sendingEmail}
                      >
                        {invoice.status === 'paid' ? "" : 
                         invoice.status === 'emailed' ? "Re-send Email" :
                         sendingEmail && selectedInvoice?.id === invoice.id ? "Sending..." : "Email Invoice"}
                      </Button>
                    </div>
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
            itemLabel="invoices"
          />
        )}
      </div>

      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">
              {selectedInvoice?.status === 'emailed' ? 'Re-send Maintenance Invoice' : 'Send Maintenance Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="toEmail" className="text-spaceText">
                To Email:
              </Label>
              <Input
                id="toEmail"
                type="email"
                value={emailForm.toEmail}
                onChange={(e) => setEmailForm({ ...emailForm, toEmail: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="recipient@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmail" className="text-spaceText">
                CC Email (Optional):
              </Label>
              <Input
                id="ccEmail"
                type="email"
                value={emailForm.ccEmail}
                onChange={(e) => setEmailForm({ ...emailForm, ccEmail: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="cc@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-spaceText">
                Subject:
              </Label>
              <Input
                id="subject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="Invoice subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-spaceText">
                Message:
              </Label>
              <Textarea
                id="message"
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent min-h-[120px]"
                placeholder="Enter your message here..."
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setEmailModalOpen(false)}
              className="bg-space1 text-spaceText border-spaceAccent hover:bg-spaceAlt"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitEmail} 
              disabled={sendingEmail}
              className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
