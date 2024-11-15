import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { addDays, format } from "date-fns"
import { customers } from '@/constants'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Project } from '@/types/project';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf 
} from '@react-pdf/renderer';
import { toast } from "sonner"
import { Quote } from '@/types/quote';

// Add PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    margin: 5,
    paddingHorizontal: 20,
    paddingTop: 5,
  },
  subHeading: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  text: {
    fontSize: 12,
    marginBottom: 10,
  },
  importantText: {
    fontSize: 12,
    marginBottom: 10,
    marginTop: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    textDecoration: 'underline',
  },
  signatureSection: {
    marginTop: 50,
    borderTop: 1,
    paddingTop: 10,
  },
  signatureLine: {
    width: '30%',
    borderBottom: 1,
  },
});

interface LetterAgreementData {
  projectId: string
  date: Date
  paymentMethod: string
  paymentDuration: string
  quoteId: string
  requirements: string
  selectedQuote: Quote | null
}

export default function LetterAgreement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [formData, setFormData] = useState<LetterAgreementData>({
    projectId: '',
    date: new Date(),
    paymentMethod: '',
    paymentDuration: '',
    quoteId: '',
    requirements: '',
    selectedQuote: null
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      const querySnapshot = await getDocs(collection(db, "projects"));
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchQuotes = async () => {
      const querySnapshot = await getDocs(collection(db, "quotes"));
      const quotesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(quotesData);
    };
    fetchQuotes();
  }, []);

  const generateAgreement = async () => {
    if (!selectedProject || !formData.selectedQuote) return;
    
    setIsGenerating(true);

    const agreementDoc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>LETTER OF AGREEMENT</Text>
          
          <View style={styles.section}>
            <Text style={styles.text}>Date: {format(formData.date, "MMMM dd, yyyy")}</Text>
            <Text style={styles.text}>Project: {selectedProject.projectType}</Text>
            <Text style={styles.text}>Client: {selectedProject.clientName}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.subHeading}>=== Overview ===</Text>
            <Text style={styles.text}>
              On the date of {format(formData.date, "MMMM dd, yyyy")}, Dylan Petzer and {selectedProject.clientName} agreed on starting this colaboration together.
            </Text>
            <Text style={styles.text}>The collaboration will end on {format(addDays(formData.date, 30), "MMMM dd, yyyy")} and has the purpose of {selectedProject.projectType}.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.text}>Project Requirements:</Text>
            {/* @ts-ignore */}
            {formData.selectedQuote.features?.map((feature, index) => (
              <Text key={index} style={styles.text}>• {feature}</Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.subHeading}>=== Guarantee ===</Text>
            <Text style={styles.text}>
              If the service we agreed upon doesn't meet your expectations and if you are not satisfied with the results coming in, you will get a full redund of my 
              commission/payment and you will be able to interrupt the agreement whenever you want.
            </Text>
            <Text style={styles.text}>In general terms, we both hold the right to stop working at any time.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.subHeading}>=== Financial Details ===</Text>
            <Text style={styles.text}>Total Amount: R{formData.selectedQuote.total_amount.toLocaleString()}</Text>
            <Text style={styles.text}>Payment Method: {formData.paymentMethod}</Text>
            <Text style={styles.text}>Payment Duration: {formData.paymentDuration}</Text>

            <Text style={styles.importantText}>A deposit of 50% will be required before the project starts.</Text>
          </View>

          <View style={styles.signatureSection}>
            <Text style={styles.text}>Date: _________________</Text>
            <Text style={styles.text}>Client Signature: _________________</Text>
          </View>
        
        </Page>
      </Document>
    );

    try {
      const pdfBlob = await pdf(agreementDoc).toBlob();
      const storageRef = ref(storage, `letter_of_agreements/${selectedProject.clientName}_${selectedProject.projectType}_agreement.pdf`);
      await uploadBytes(storageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(storageRef);

      // Update project with agreement URL
      const projectRef = doc(db, "projects", selectedProject.id);
      await updateDoc(projectRef, {
        agreementUrl: pdfUrl,
        agreementStatus: 'pending'
      });

      toast.success("Agreement generated and uploaded successfully!");
    } catch (error) {
      console.error("Error generating agreement:", error);
      toast.error("Failed to generate agreement. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Letter of Agreement</CardTitle>
        <CardDescription className="text-spaceAccent">
          Generate a formal agreement document for client signature
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Selection - Replace Client Selection */}
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

        {/* Date Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Agreement Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full bg-space1 text-spaceText border-spaceAccent justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-space1">
              <Calendar
                mode="single"
                selected={formData.date}
                onSelect={(date) => date && setFormData({...formData, date})}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label className="text-spaceText">Payment Method</Label>
          <Select onValueChange={(value) => setFormData({...formData, paymentMethod: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Credit Card">Credit Card</SelectItem>
              <SelectItem value="PayPal">PayPal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment Duration */}
        <div className="space-y-2">
          <Label className="text-spaceText">Payment Duration</Label>
          <Select onValueChange={(value) => setFormData({...formData, paymentDuration: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select payment duration" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="One Time Payment">One Time Payment</SelectItem>
              <SelectItem value="Monthly Payments">Monthly Payments</SelectItem>
              <SelectItem value="Project Milestones">Project Milestones</SelectItem>
              <SelectItem value="Full Project Suits">Full Project Suits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quote Link */}
        <div className="space-y-2">
          <Label className="text-spaceText">Quote Reference</Label>
          <Select 
            onValueChange={(value) => {
              const quote = quotes.find(q => q.id === value);
              setFormData({
                ...formData, 
                quoteId: value,
                selectedQuote: quote || null,
                // @ts-ignore
                requirements: quote?.features?.join('\n') || ''
              });
            }}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select associated quote" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {quotes
                .filter(quote => quote.project_id === formData.projectId)
                .map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    Quote #{quote.id} - R{quote.total_amount.toLocaleString()}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <Label className="text-spaceText">Project Requirements</Label>
          <Textarea 
            className="bg-space1 text-spaceText border-spaceAccent min-h-[100px]"
            placeholder="Enter detailed project requirements..."
            value={formData.requirements}
            onChange={(e) => setFormData({...formData, requirements: e.target.value})}
          />
        </div>

        <Button 
          className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt"
          onClick={generateAgreement}
          disabled={!selectedProject || isGenerating}
        >
          {isGenerating ? "Generating Agreement..." : "Generate Agreement"}
        </Button>
      </CardContent>
    </Card>
  )
}
