import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format } from 'date-fns'
import { toast } from "sonner"
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'

interface MaintenanceItem {
  title: string;
  hours: number;
  amount: number;
}

interface MaintenanceInvoice {
  id: string;
  projectId: string;
  clientId: string;
  company: string;
  date: any; // Firestore Timestamp
  hourlyRate: number;
  items: MaintenanceItem[];
  totalAmount: number;
  pdfUrl: string;
  status: string;
}

interface Client {
  name: string;
  companyName: string;
  email: string;
}

export default function MaintenanceTable() {
  const [invoices, setInvoices] = useState<MaintenanceInvoice[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingInvoice, setUpdatingInvoice] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const q = query(collection(db, "maintenance_invoices"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const invoicesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MaintenanceInvoice[];
        setInvoices(invoicesData);

        // Fetch client data for all invoices
        const clientIds = Array.from(new Set(invoicesData.map(invoice => invoice.clientId)));
        const clientsData: Record<string, Client> = {};
        
        for (const clientId of clientIds) {
          const clientDoc = await getDoc(doc(db, "customers", clientId));
          if (clientDoc.exists()) {
            clientsData[clientId] = clientDoc.data() as Client;
          }
        }
        
        setClients(clientsData);
      } catch (error) {
        console.error("Error fetching maintenance invoices:", error);
        toast.error("Failed to load maintenance invoices");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const setStatus = (status: string) => {
    if (status === 'paid') {
      return 'Paid';
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
      .filter(invoice => invoice.status === 'pending')
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

  const handleMarkAsPaid = async (invoiceId: string) => {
    setUpdatingInvoice(invoiceId);
    try {
      const invoiceRef = doc(db, "maintenance_invoices", invoiceId);
      await updateDoc(invoiceRef, {
        status: 'paid'
      });
      
      // Update the local state to reflect the change
      setInvoices(prevInvoices => 
        prevInvoices.map(invoice => 
          invoice.id === invoiceId 
            ? { ...invoice, status: 'paid' }
            : invoice
        )
      );
      
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
      setInvoices(prevInvoices => prevInvoices.filter(invoice => invoice.id !== invoiceId));
      toast.success("Invoice deleted successfully!");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice. Please try again.");
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <TableHead className="text-spaceText">Date</TableHead>
              <TableHead className="text-spaceText">Client</TableHead>
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
                <TableCell colSpan={8} className="text-center text-spaceText py-8">
                  No maintenance invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-space1">
                  <TableCell className="text-spaceText">
                    {formatDate(invoice.date)}
                  </TableCell>
                  <TableCell className="text-spaceText">
                    {clients[invoice.clientId]?.name || 'Unknown Client'}
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
                        onClick={() => window.open(invoice.pdfUrl, '_blank')}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
