import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore'
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
}

export default function MaintenanceTable() {
  const [invoices, setInvoices] = useState<MaintenanceInvoice[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-spaceText">Loading maintenance invoices...</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-spaceAccent">
      <Table>
        <TableHeader>
          <TableRow className="bg-space2">
            <TableHead className="text-spaceText">Date</TableHead>
            <TableHead className="text-spaceText">Client</TableHead>
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
              <TableCell colSpan={7} className="text-center text-spaceText py-8">
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
                  <div className="flex space-x-2">
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
                      className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
                      onClick={() => {
                        // TODO: Implement mark as paid functionality
                        toast.info("Mark as paid functionality coming soon");
                      }}
                    >
                      Mark as Paid
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
