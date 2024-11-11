import React from 'react';
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
import { collection, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from "sonner"

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
  estimatedHours: number;
  hourlyRate: number;
}

// Add props interface
interface GenerateQuoteButtonProps {
  formData: FormData;
  calculateQuote: () => number;
  projectId: string;
}

// Update component with correct types
export const GenerateQuoteButton: React.FC<GenerateQuoteButtonProps> = ({ formData, calculateQuote, projectId }) => {
  const handleGenerateQuote = async () => {
    try {
      // Generate quote ID first
      const quoteRef = doc(collection(db, "quotes"))
      
      // Generate PDF blob
      const pdfBlob = await pdf(<QuotePDF formData={formData} totalAmount={calculateQuote()} />).toBlob();
      
      // Create a reference to the storage location
      const storageRef = ref(storage, `quotes/${quoteRef.id}.pdf`);
      
      // Upload PDF to storage
      await uploadBytes(storageRef, pdfBlob);
      
      // Get the download URL
      const pdfUrl = await getDownloadURL(storageRef);
      
      // Create quote document with PDF URL and correct project_type field
      const quoteData = {
        ...formData,
        project_id: projectId,
        project_type: formData.projectType,
        total_amount: calculateQuote(),
        status: 'pending',
        created_at: serverTimestamp(),
        pdf_url: pdfUrl,
      }
      
      await setDoc(quoteRef, quoteData)

      // Update the project with the quote reference
      const projectRef = doc(db, "projects", projectId)
      await updateDoc(projectRef, {
        quoteId: quoteRef.id
      })

      toast.success("Quote generated successfully!")
    } catch (error) {
      console.error("Error generating quote:", error);
      toast.error("Failed to generate quote. Please try again.")
    }
  };

  return (
    <Button 
      className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt mt-6"
      onClick={handleGenerateQuote}
      disabled={!projectId}
    >
      Generate Quote
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
}

// PDF Document Component
const QuotePDF: React.FC<QuotePDFProps> = ({ formData, totalAmount }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Development Quote</Text>
        <Text style={styles.subtitle}>
          Generated on {format(new Date(), 'MMMM dd, yyyy')}
        </Text>
      </View>

      {/* Client Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Client ID:</Text>
          <Text style={styles.value}>{formData.clientId}</Text>
        </View>
      </View>

      {/* Project Details */}
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
      </View>

      {/* Calculation Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quote Calculation</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Estimated Hours:</Text>
          <Text style={styles.value}>{formData.estimatedHours}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Hourly Rate:</Text>
          <Text style={styles.value}>R{formData.hourlyRate}</Text>
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
        This quote is valid for 30 days from the date of generation.
        All prices are in South African Rand (ZAR).
      </Text>
    </Page>
  </Document>
);