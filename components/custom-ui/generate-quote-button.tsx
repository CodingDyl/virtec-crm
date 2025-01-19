import React, { useState, useEffect } from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button"
import { db, storage } from '@/firebase/firebaseConfig';
import { collection, doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
// @ts-ignore
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from "sonner"
import { Project } from '@/types/project';

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

// Add interface for form data
interface FormData {
  clientId: string;
  projectId: string;
  projectType: string;
  complexity: 'Low' | 'Medium' | 'High';
  urgency: 'Standard' | 'Rush' | 'Extreme Rush';
  features: string[];
  estimatedHours: number;
  hourlyRate: number;
  hostingCost: number;
  maintenanceCost: number;
  documentType: 'Quote' | 'Invoice';
}

// Add props interface
interface GenerateQuoteButtonProps {
  formData: FormData;
  calculateQuote: () => number;
  projectId: string;
  onSuccess?: () => void;
  selectedProject: Project | null;
  company: string;
}

// Update component with correct types
export const GenerateQuoteButton: React.FC<GenerateQuoteButtonProps> = ({ 
  formData, 
  calculateQuote, 
  projectId,
  onSuccess,
  company,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  // @ts-ignore
  const [clientData, setClientData] = useState<any>(null);

  // Fetch project and client data using projectId
  useEffect(() => {
    const fetchProjectAndClientData = async () => {
      try {
        // Fetch project data
        const projectDoc = await getDoc(doc(db, "projects", projectId));
        if (projectDoc.exists()) {
          const projectData = projectDoc.data();
          
          // Fetch client data using clientId from project data
          const clientDoc = await getDoc(doc(db, "customers", projectData.clientId));
          if (clientDoc.exists()) {
            setClientData(clientDoc.data());
          }
        }
      } catch (error) {
        console.error("Error fetching project or client data:", error);
      }
    };

    if (projectId) {
      fetchProjectAndClientData();
    }
  }, [projectId]);

  const handleGenerateQuote = async () => {
    setIsLoading(true);
    try {
      const quoteRef = doc(collection(db, "quotes"));
      
      const pdfBlob = await pdf(
        <QuotePDF 
          formData={formData} 
          totalAmount={calculateQuote()} 
          clientData={clientData}
          company={company}
        />
      ).toBlob();
      
      // Create a sanitized client name for the file name
      const sanitizedClientName = clientData?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown_client';
      const storageRef = ref(storage, `quotes/${sanitizedClientName}_${quoteRef.id}_quote.pdf`);
      
      await uploadBytes(storageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(storageRef);
      
      const quoteData = {
        ...formData,
        project_id: projectId,
        project_type: formData.projectType,
        total_amount: calculateQuote(),
        status: 'pending',
        created_at: serverTimestamp(),
        pdf_url: pdfUrl,
        features: formData.features,
        hosting_cost: formData.hostingCost,
        maintenance_cost: formData.maintenanceCost
      };
      
      await setDoc(quoteRef, quoteData);

      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        quoteId: quoteRef.id
      });

      toast.success("Quote generated successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error generating quote:", error);
      toast.error("Failed to generate quote. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt mt-6"
      onClick={handleGenerateQuote}
      disabled={!projectId || isLoading}
    >
      {isLoading ? "Generating..." : "Generate Quote"}
    </Button>
  );
};

// Add the multipliers that were missing
const COMPLEXITY_MULTIPLIERS = {
  Low: 1,
  Medium: 1.5,
  High: 2
}

const URGENCY_MULTIPLIERS = {
  Standard: 1,
  Rush: 1.2,
  'Extreme Rush': 1.4
}

interface QuotePDFProps {
  formData: FormData;
  totalAmount: number;
  // @ts-ignore
  clientData: any;
  company: string;
}

// PDF Document Component
const QuotePDF: React.FC<QuotePDFProps> = ({ formData, totalAmount, clientData, company }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{company} {formData.documentType}</Text>
          <Text style={styles.subtitle}>
            Generated on {format(new Date(), 'MMMM dd, yyyy')}
          </Text>
        </View>

        {/* Updated Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          {clientData && (
            <>
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
            </>
          )}
        </View>

        {/* Project Details - Add Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Project Type:</Text>
            <Text style={styles.value}>{formData.projectType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Complexity:</Text>
            <Text style={styles.value}>{formData.complexity}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Urgency:</Text>
            <Text style={styles.value}>{formData.urgency}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Features:</Text>
            <Text style={styles.value}>{formData.features.join(", ")}</Text>
          </View>
        </View>

        {/* Add Hosting & Maintenance if applicable */}
        {(formData.hostingCost > 0 || formData.maintenanceCost > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Services</Text>
            {formData.hostingCost > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Monthly Hosting:</Text>
                <Text style={styles.value}>R{formData.hostingCost.toLocaleString()}</Text>
              </View>
            )}
            {formData.maintenanceCost > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Monthly Maintenance:</Text>
                <Text style={styles.value}>R{formData.maintenanceCost.toLocaleString()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Calculation Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Calculation</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Days to Completion:</Text>
            <Text style={styles.value}>{Math.ceil((formData.estimatedHours / 5)) * 2 }</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Complexity Multiplier:</Text>
            <Text style={styles.value}>
              {COMPLEXITY_MULTIPLIERS[formData.complexity]}x
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Urgency Multiplier:</Text>
            <Text style={styles.value}>
              {URGENCY_MULTIPLIERS[formData.urgency]}x
            </Text>
          </View>
        </View>

        {/* Total */}
        <View style={styles.total}>
          <View style={styles.row}>
            <Text style={styles.totalText}>Total Amount:</Text>
            <Text style={styles.totalText}>
              R{totalAmount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {formData.documentType === 'Quote' 
            ? 'This quote is valid for 30 days from the date of generation.'
            : 'This invoice is due within 30 days from the date of generation.'
          }
          All prices are in South African Rand (ZAR).
        </Text>
      </Page>
    </Document>
  );
};