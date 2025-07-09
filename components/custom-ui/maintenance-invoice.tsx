import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '@/firebase/firebaseConfig'
import { Project } from '@/types/project'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { format } from 'date-fns'
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf 
} from '@react-pdf/renderer'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from "sonner"
import { Quantum } from 'ldrs/react'

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 30,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  label: {
    fontSize: 12,
    color: '#333333',
  },
  value: {
    fontSize: 12,
    color: '#666666',
    flexWrap: 'wrap'
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
  },
  tableCol: {
    width: '33%',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    padding: 5,
  },
  tableCell: {
    fontSize: 12,
    color: '#333333',
  },
  total: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
});

interface MaintenanceItem {
  title: string;
  hours: number;
  amount: number;
}

interface MaintenanceInvoiceData {
  projectId: string;
  clientId: string;
  company: string;
  date: Date;
  hourlyRate: number;
  items: MaintenanceItem[];
  totalAmount: number;
  pdfUrl: string;
  status: string;
}

export default function MaintenanceInvoice() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [formData, setFormData] = useState<MaintenanceInvoiceData>({
    projectId: '',
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
  useEffect(() => {
    const fetchProjects = async () => {
      const querySnapshot = await getDocs(collection(db, "projects"));
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setIsLoading(false);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchClientData = async () => {
      if (selectedProject) {
        const clientDoc = await getDoc(doc(db, "customers", selectedProject.clientName));
        if (clientDoc.exists()) {
          setClientData(clientDoc.data());
          setFormData(prev => ({
            ...prev,
            clientId: selectedProject.clientName
          }));
        }
      }
    };
    fetchClientData();
  }, [selectedProject]);

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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { title: '', hours: 0, amount: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const generateInvoice = async () => {
    if (!selectedProject) return;
    
    setIsGenerating(true);
    try {
      // Fetch project data first
      const projectDoc = await getDoc(doc(db, "projects", selectedProject.id));
      if (!projectDoc.exists()) {
        toast.error("Project data not found");
        return;
      }
      
      const projectData = projectDoc.data();
      
      // Fetch client data using clientId from project data
      const clientDoc = await getDoc(doc(db, "customers", projectData.clientId));
      if (!clientDoc.exists()) {
        toast.error("Client data not found");
        return;
      }
      
      const clientData = clientDoc.data();

      const invoiceDoc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>{formData.company} Maintenance Invoice</Text>
              <Text style={styles.subtitle}>
                Generated on {format(formData.date, 'MMMM dd, yyyy')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client Information</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Client Name:</Text>
                <Text style={styles.value}>{clientData.name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Company:</Text>
                <Text style={styles.value}>{clientData.companyName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Contact:</Text>
                <Text style={styles.value}>{clientData.contactNumber}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{clientData.email}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Maintenance Items</Text>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>Update Title</Text>
                  </View>
                  <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>Time (Hours)</Text>
                  </View>
                  <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>Amount (R)</Text>
                  </View>
                </View>
                {formData.items.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <View style={styles.tableCol}>
                      <Text style={styles.tableCell}>{item.title}</Text>
                    </View>
                    <View style={styles.tableCol}>
                      <Text style={styles.tableCell}>{item.hours}</Text>
                    </View>
                    <View style={styles.tableCol}>
                      <Text style={styles.tableCell}>{item.amount.toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.total}>
              <View style={styles.row}>
                <Text style={styles.totalText}>Total Amount:</Text>
                <Text style={styles.totalText}>R{calculateTotal().toLocaleString()}</Text>
              </View>
            </View>

            <Text style={styles.footer}>
              This invoice is due within 30 days from the date of generation.
              All prices are in South African Rand (ZAR).
            </Text>
          </Page>
        </Document>
      );

      const pdfBlob = await pdf(invoiceDoc).toBlob();
      const storageRef = ref(storage, `maintenance_invoices/${projectData.clientId}_${format(formData.date, 'yyyy-MM-dd')}_invoice.pdf`);
      await uploadBytes(storageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(storageRef);

      // Save invoice data to Firestore with updated structure
      const invoiceRef = doc(collection(db, "maintenance_invoices"));
      await setDoc(invoiceRef, {
        projectId: selectedProject.id,
        clientId: projectData.clientId,
        company: formData.company,
        date: serverTimestamp(),
        hourlyRate: formData.hourlyRate,
        items: formData.items,
        totalAmount: calculateTotal(),
        pdfUrl,
        status: 'pending'
      });

      toast.success("Maintenance invoice generated successfully!");
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
        <p className="text-spaceText">Fetching projects...</p>
      </div>
    )
  }

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Maintenance Invoice</CardTitle>
        <CardDescription className="text-spaceAccent">
          Generate a maintenance invoice for ongoing projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Project</Label>
          <Select 
            onValueChange={(value) => {
              const project = projects.find(p => p.id === value);
              setSelectedProject(project || null);
              setFormData({ ...formData, projectId: value });
            }}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectType} - {project.clientName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          disabled={!selectedProject || isGenerating}
        >
          {isGenerating ? "Generating Invoice..." : "Generate Invoice"}
        </Button>
      </CardContent>
    </Card>
  );
}

