import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { Customer } from '@/types/customer'
import { Project } from '@/types/project'
import { frequencyLabel, isMaintenanceProject } from '@/lib/maintenance'
import { logActivity } from '@/lib/activity'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from 'date-fns'
import { uploadFile } from '@/lib/storage-client'
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

/**
 * One row you can bill. Normally a maintenance project, so the invoice attaches
 * to it — that link is what lets a project accumulate a cycle's worth of
 * invoices. Customers flagged for maintenance but without a maintenance project
 * still appear, so no existing billing workflow breaks; their invoices land
 * unattached and can be linked from the project's Maintenance tab later.
 */
interface BillingTarget {
  key: string;
  customer: Customer;
  projectId: string;
  projectLabel: string | null;
  cadence: string | null;
}

export default function MaintenanceInvoice() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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

  /**
   * Hand an allocated number back when the invoice it was minted for never
   * lands. The number has to be allocated before the PDF is rendered, because
   * the PDF prints it — so every step after allocation is a chance to strand
   * one.
   *
   * Only the most recent allocation can be released. If another invoice has
   * taken a number in the meantime, rolling back would re-issue this one, so
   * the number stays spent and the sequence keeps a gap. A gap is harmless; a
   * duplicate invoice number is not.
   */
  const releaseInvoiceNumber = async (invoiceNumber: string): Promise<void> => {
    const parsed = invoiceNumber.match(/^VRT-(\d{4})-(\d+)$/);
    if (!parsed) return;

    const year = Number(parsed[1]);
    const seq = Number(parsed[2]);
    const counterRef = doc(db, "system_counters", "maintenance_invoice");

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterRef);
        const data = snap.data() as { year?: number; lastNumber?: number } | undefined;

        if (data?.year !== year || data?.lastNumber !== seq) return;

        transaction.set(counterRef, {
          year,
          lastNumber: seq - 1,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
    } catch (error) {
      // A failed rollback costs nothing but a gap, so it must never replace
      // the error that actually stopped the invoice.
      console.error('Could not release invoice number', invoiceNumber, error);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const [customersSnapshot, projectsSnapshot] = await Promise.all([
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "projects")),
        ]);

        setCustomers(customersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Customer[]);

        setProjects(projectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Project[]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const { linkedTargets, unlinkedTargets } = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.status !== false);
    const byId = new Map(activeCustomers.map((c) => [(c.id || '').trim(), c]));
    // Older projects carry only a client name, so fall back to matching on that.
    const byCompany = new Map(
      activeCustomers.map((c) => [normalizeCompanyName(c.companyName), c])
    );

    const linked: BillingTarget[] = [];
    const covered = new Set<string>();

    projects.filter(isMaintenanceProject).forEach((project) => {
      const clientId = (project.clientId ?? '').toString().trim();
      const customer =
        byId.get(clientId) ??
        byCompany.get(normalizeCompanyName(project.clientName ?? ''));
      if (!customer?.id) return;

      covered.add(customer.id);
      linked.push({
        key: project.id,
        customer,
        projectId: project.id,
        projectLabel: project.projectType || 'Maintenance',
        cadence: project.maintenanceFrequency ? frequencyLabel(project.maintenanceFrequency) : null,
      });
    });

    linked.sort((a, b) =>
      (a.customer.companyName || a.customer.name || '').localeCompare(
        b.customer.companyName || b.customer.name || ''
      )
    );

    const unlinked: BillingTarget[] = activeCustomers
      .filter((c) => c.maintenance === true && c.id && !covered.has(c.id))
      .map((customer) => ({
        key: `customer:${customer.id}`,
        customer,
        projectId: '',
        projectLabel: null,
        cadence: null,
      }));

    return { linkedTargets: linked, unlinkedTargets: unlinked };
  }, [customers, projects]);

  const allTargets = useMemo(
    () => [...linkedTargets, ...unlinkedTargets],
    [linkedTargets, unlinkedTargets]
  );

  const toggleTarget = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

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
    const targets = allTargets.filter((t) => selectedKeys.includes(t.key));
    if (targets.length === 0) {
      toast.error("Select at least one maintenance project or customer.");
      return;
    }
    if (targets.some((t) => !(t.customer.id || '').toString().trim())) {
      toast.error("Cannot generate invoice without a linked customer (clientId).");
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

      for (const target of targets) {
        const customerId = (target.customer.id ?? '').toString().trim();
        if (!customerId) {
          failedCustomers.push(target.customer.companyName || target.customer.name || 'unknown');
          continue;
        }
        const clientDoc = await getDoc(doc(db, "customers", customerId));
        if (!clientDoc.exists()) {
          failedCustomers.push(customerId);
          continue;
        }

        const customerData = clientDoc.data() as Customer;
        const invoiceRef = doc(collection(db, "maintenance_invoices"));
        const invoiceNumber = await generateInvoiceNumber();

        try {
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
          const pdfPath = await uploadFile(pdfBlob, 'invoices', `${invoiceRef.id}_${customerId}_${timestamp}_invoice.pdf`);

          await setDoc(invoiceRef, {
            invoiceNumber,
            projectId: target.projectId || '',
            // Real customer link — required for cash aggregation (never use issuer company as the key).
            clientId: customerId,
            clientName: customerData.companyName || customerData.name || '',
            company: customerData.companyName || formData.company,
            date: serverTimestamp(),
            hourlyRate: formData.hourlyRate,
            items: validItems,
            totalAmount,
            pdfPath,
            status: 'pending'
          });
        } catch (error) {
          // Nothing was written for this invoice, so give its number back
          // rather than leave a permanent hole in the sequence.
          await releaseInvoiceNumber(invoiceNumber);
          throw error;
        }

        if (target.projectId) {
          await logActivity(
            'project',
            target.projectId,
            'maintenance',
            `Maintenance invoice ${invoiceNumber} raised — R${totalAmount.toLocaleString()}`
          );
        }

        generatedCount += 1;
      }

      if (generatedCount > 0) {
        setSelectedKeys([]);
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
            <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Selected</p>
            <p className="text-xl font-semibold text-spaceText">{selectedKeys.length}</p>
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

        {/* Billing target selection — a maintenance project wherever one exists */}
        <div className="space-y-2">
          <Label className="text-spaceText">Bill to</Label>
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-spaceAccent bg-space1 p-3">
            {allTargets.length === 0 ? (
              <p className="text-sm text-spaceAlt">
                No active maintenance customers found. Flag a customer for maintenance, or give them
                a project of type “Maintenance”.
              </p>
            ) : (
              <>
                {linkedTargets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">
                      Maintenance projects
                    </p>
                    {linkedTargets.map((target) => (
                      <label
                        key={target.key}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-spaceAccent/20 bg-space2/50 p-2"
                      >
                        <Checkbox
                          checked={selectedKeys.includes(target.key)}
                          onCheckedChange={(checked) => toggleTarget(target.key, checked === true)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-spaceText">
                              {target.customer.companyName || target.customer.name}
                            </p>
                            {target.cadence && (
                              <span className="rounded-full border border-spaceAccent/30 px-2 py-0.5 text-[10px] text-spaceAlt/90">
                                {target.cadence}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-spaceAlt">
                            {target.projectLabel} · {target.customer.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {unlinkedTargets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-yellow-300/80">
                      No maintenance project — invoice won&apos;t be tracked against one
                    </p>
                    {unlinkedTargets.map((target) => (
                      <label
                        key={target.key}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-2"
                      >
                        <Checkbox
                          checked={selectedKeys.includes(target.key)}
                          onCheckedChange={(checked) => toggleTarget(target.key, checked === true)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-spaceText">
                            {target.customer.companyName || target.customer.name}
                          </p>
                          <p className="truncate text-xs text-spaceAlt">
                            {target.customer.name} · {target.customer.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
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
          disabled={selectedKeys.length === 0 || isGenerating}
        >
          {isGenerating ? "Generating Invoices..." : "Generate Invoices"}
        </Button>
      </CardContent>
    </Card>
  );
}
