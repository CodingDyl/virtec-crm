import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db, storage } from '@/firebase/firebaseConfig'
import { Customer } from '@/types/customer'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from 'date-fns'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from "sonner"
import { Quantum } from 'ldrs/react'

interface MaintenanceItem {
  title: string;
  hours: number;
  amount: number;
}

interface MaintenanceInvoiceData {
  clientId: string;
  company: string;
  date: Date;
  hourlyRate: number;
  items: MaintenanceItem[];
  totalAmount: number;
  pdfUrl: string;
  status: string;
  invoiceNumber?: string;
}

export default function MaintenanceInvoice() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [maintenanceProjectCustomerIds, setMaintenanceProjectCustomerIds] = useState<Set<string>>(new Set());
  const [maintenanceProjectClientNames, setMaintenanceProjectClientNames] = useState<Set<string>>(new Set());
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<MaintenanceInvoiceData>({
    clientId: '',
    company: 'Virtara',
    date: new Date(),
    hourlyRate: 300,
    items: [{ title: '', hours: 0, amount: 0 }],
    totalAmount: 0,
    pdfUrl: '',
    status: 'pending'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeCompanyName = (value?: string) => (value || '').trim().toLowerCase();

  const generateInvoiceNumber = async (): Promise<string> => {
    const counterRef = doc(db, "system_counters", "maintenance_invoice");
    return runTransaction(db, async (transaction) => {
      const currentYear = new Date().getFullYear();
      const counterSnap = await transaction.get(counterRef);
      const data = counterSnap.data() as { year?: number; lastNumber?: number } | undefined;

      const previousYear = data?.year ?? currentYear;
      const lastNumber = data?.lastNumber ?? 0;
      const nextNumber = previousYear === currentYear ? lastNumber + 1 : 1;

      transaction.set(counterRef, {
        year: currentYear,
        lastNumber: nextNumber,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return `VRT-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
    });
  };
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const [customersSnapshot, projectsSnapshot] = await Promise.all([
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "projects")),
        ]);

        const customersData = customersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Customer[];

        const maintenanceCustomerIds = new Set<string>();
        const maintenanceClientNames = new Set<string>();

        projectsSnapshot.docs.forEach((projectDoc) => {
          const project = projectDoc.data() as Record<string, any>;
          const rawProjectType = (project.projectType ?? project.project_type ?? '').toString();
          const isMaintenanceProject = rawProjectType.trim().toLowerCase() === 'maintenance';
          if (!isMaintenanceProject) return;

          const clientId = (project.clientId ?? project.client_id ?? '').toString().trim();
          if (clientId) maintenanceCustomerIds.add(clientId);

          const clientName = normalizeCompanyName((project.clientName ?? project.companyName ?? '').toString());
          if (clientName) maintenanceClientNames.add(clientName);
        });

        setCustomers(customersData);
        setMaintenanceProjectCustomerIds(maintenanceCustomerIds);
        setMaintenanceProjectClientNames(maintenanceClientNames);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const availableCustomers = customers.filter((customer) => {
    const isActive = customer.status !== false;
    const hasMaintenanceFlag = customer.maintenance === true;
    const customerId = (customer.id || '').trim();
    const companyName = normalizeCompanyName(customer.companyName);
    const hasMaintenanceProject = maintenanceProjectCustomerIds.has(customerId) || maintenanceProjectClientNames.has(companyName);

    return isActive && (hasMaintenanceFlag || hasMaintenanceProject);
  });

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  useEffect(() => {
    const total = calculateTotal();
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.items]);

  const handleItemChange = (index: number, field: keyof MaintenanceItem, value: string | number) => {
    const newItems = [...formData.items];
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'title' ? value : numValue,
      amount: field === 'hours' ? numValue * formData.hourlyRate : newItems[index].amount
    };
    setFormData({ ...formData, items: newItems });
  };

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        amount: Number((item.hours * prev.hourlyRate).toFixed(2)),
      })),
    }));
  }, [formData.hourlyRate]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { title: '', hours: 0, amount: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const generateInvoice = async () => {
    if (selectedCustomerIds.length === 0) {
      toast.error("Select at least one customer.");
      return;
    }

    const hasValidItems = formData.items.some((item) => item.title.trim() && item.hours > 0);
    if (!hasValidItems) {
      toast.error("Add at least one maintenance item with a title and hours.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const validItems = formData.items.filter((item) => item.title.trim() && item.hours > 0);
      const totalAmount = validItems.reduce((sum, item) => sum + item.amount, 0);
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const failedCustomers: string[] = [];
      let generatedCount = 0;

      for (const customerId of selectedCustomerIds) {
        const clientDoc = await getDoc(doc(db, "customers", customerId));
        if (!clientDoc.exists()) {
          failedCustomers.push(customerId);
          continue;
        }
        
        const customerData = clientDoc.data() as Customer;
        const invoiceRef = doc(collection(db, "maintenance_invoices"));
        const invoiceNumber = await generateInvoiceNumber();

        const pdfResponse = await fetch('/api/maintenance-invoice-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: formData.company,
            date: formData.date.toISOString(),
            invoiceNumber,
            customer: {
              name: customerData.name || '',
              companyName: customerData.companyName || '',
              contactNumber: customerData.contactNumber || '',
            },
            items: validItems.map((item) => ({
              title: item.title || '',
              hours: Number(item.hours) || 0,
              amount: Number(item.amount) || 0,
            })),
            totalAmount,
          }),
        });
        if (!pdfResponse.ok) {
          throw new Error(`PDF generation failed with status ${pdfResponse.status}`);
        }
        const pdfBlob = await pdfResponse.blob();
        const storageRef = ref(storage, `maintenance_invoices/${invoiceRef.id}_${customerId}_${timestamp}_invoice.pdf`);
        await uploadBytes(storageRef, pdfBlob);
        const pdfUrl = await getDownloadURL(storageRef);

        await setDoc(invoiceRef, {
          invoiceNumber,
          projectId: '',
          clientId: customerId,
          company: formData.company,
          date: serverTimestamp(),
          hourlyRate: formData.hourlyRate,
          items: validItems,
          totalAmount,
          pdfUrl,
          status: 'pending'
        });

        generatedCount += 1;
      }

      if (generatedCount > 0) {
        toast.success(`Generated ${generatedCount} maintenance invoice${generatedCount > 1 ? 's' : ''}.`);
      }
      if (failedCustomers.length > 0) {
        toast.error(`Could not generate ${failedCustomers.length} invoice${failedCustomers.length > 1 ? 's' : ''} due to missing customer data.`);
      }
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[500px] w-full flex flex-col items-center justify-center p-8 gap-4">
        <Quantum
          size="100"
          speed="1.75"
          color="white" 
        />
        <p className="text-spaceText">Fetching customers...</p>
      </div>
    )
  }

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Maintenance Invoice</CardTitle>
        <CardDescription className="text-spaceAccent">
          Generate branded maintenance invoices for one or more maintenance customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-spaceAccent/25 bg-space1/40 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Line Items</p>
            <p className="text-xl font-semibold text-spaceText">{formData.items.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Customers</p>
            <p className="text-xl font-semibold text-spaceText">{selectedCustomerIds.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Total Hours</p>
            <p className="text-xl font-semibold text-spaceText">
              {formData.items.reduce((sum, item) => sum + (item.hours || 0), 0).toFixed(1)}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Current Total</p>
            <p className="text-xl font-semibold text-spaceAccent">R{(formData.totalAmount || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Customers (Maintenance)</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-spaceAccent bg-space1 p-3">
            {availableCustomers.length === 0 ? (
              <p className="text-sm text-spaceAlt">No active maintenance customers found.</p>
            ) : (
              availableCustomers.map((customer) => {
                const customerId = customer.id || '';
                return (
                  <label key={customerId} className="flex cursor-pointer items-start gap-3 rounded-md border border-spaceAccent/20 bg-space2/50 p-2">
                    <Checkbox
                      checked={selectedCustomerIds.includes(customerId)}
                      onCheckedChange={(checked) => {
                        if (!customerId) return;
                        setSelectedCustomerIds((prev) =>
                          checked
                            ? [...prev, customerId]
                            : prev.filter((id) => id !== customerId)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-spaceText">{customer.companyName}</p>
                      <p className="text-xs text-spaceAlt">{customer.name} · {customer.email}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Company Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Company</Label>
          <Select
            onValueChange={(value) => setFormData({...formData, company: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Virtara">Virtara</SelectItem>
              <SelectItem value="Three Sixty Development">Three Sixty Development</SelectItem>
              <SelectItem value="Dylan Petzer">Dylan Petzer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hourly Rate */}
        <div className="space-y-2">
          <Label className="text-spaceText">Hourly Rate (R)</Label>
          <Input 
            type="number"
            className="bg-space1 text-spaceText border-spaceAccent"
            value={formData.hourlyRate || 0}
            onChange={(e) => setFormData({
              ...formData, 
              hourlyRate: parseFloat(e.target.value) || 0
            })}
          />
        </div>

        {/* Maintenance Items */}
        <div className="space-y-4">
          <Label className="text-spaceText">Maintenance Items</Label>
          {formData.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-5">
                <Label className="text-spaceText">Update Title</Label>
                <Input 
                  className="bg-space1 text-spaceText border-spaceAccent"
                  value={item.title}
                  onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-spaceText">Hours</Label>
                <Input 
                  type="number"
                  className="bg-space1 text-spaceText border-spaceAccent"
                  value={item.hours || 0}
                  onChange={(e) => handleItemChange(index, 'hours', e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-spaceText">Amount (R)</Label>
                <Input 
                  type="number"
                  className="bg-space1 text-spaceText border-spaceAccent"
                  value={item.amount || 0}
                  readOnly
                />
              </div>
              <div className="col-span-1">
                <Button 
                  variant="destructive"
                  onClick={() => removeItem(index)}
                  className="w-full"
                  disabled={formData.items.length === 1}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          <Button 
            onClick={addItem}
            className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt"
          >
            Add Item
          </Button>
        </div>

        {/* Total Preview */}
        <div className="mt-6 p-4 bg-space1 rounded-lg">
          <h3 className="text-spaceText font-semibold mb-2">Total Amount</h3>
          <p className="text-spaceAccent text-2xl font-bold">
            R{(formData.totalAmount || 0).toLocaleString()}
          </p>
        </div>

        <Button 
          className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt z-50"
          onClick={generateInvoice}
          disabled={selectedCustomerIds.length === 0 || isGenerating}
        >
          {isGenerating ? "Generating Invoices..." : "Generate Invoices"}
        </Button>
      </CardContent>
    </Card>
  );
}
