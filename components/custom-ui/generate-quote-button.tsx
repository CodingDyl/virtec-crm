'use client';

import React, { useState, useEffect } from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  Image as PdfImage,
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
import icon from '@/app/icon.png';
import { features } from '@/constants';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f7fbff',
    padding: 30,
  },
  headerCard: {
    backgroundColor: '#060A11',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  brandText: {
    fontSize: 12,
    color: '#8DF6FF',
    letterSpacing: 0.8,
  },
  header: {
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#EDF4FF',
  },
  subtitle: {
    fontSize: 11,
    color: '#B8D3F0',
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    fontSize: 9,
    color: '#8DF6FF',
    borderWidth: 1,
    borderColor: '#18426f',
    borderRadius: 999,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  section: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e8fb',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0e3563',
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    color: '#425f82',
  },
  value: {
    fontSize: 10,
    color: '#122943',
    flexWrap: 'wrap',
    lineHeight: 1.4
  },
  total: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#060A11',
    padding: 12,
  },
  totalText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8DF6FF',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 9,
    color: '#54708f',
    textAlign: 'center',
  },
  featureItem: {
    marginTop: 5,
    marginLeft: 10,
  },
  featureDescription: {
    fontSize: 10,
    color: '#666666',
    marginLeft: 10,
    marginTop: 2,
    lineHeight: 1.3,
  },
});
const BRAND_LOGO_SRC = icon?.src;

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
  discountType: 'none' | 'percentage' | 'hourly' | 'hours';
  discountValue: number;
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

  const getErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return String(error);
  };

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
        projectId,
        project_id: projectId, // legacy compatibility
        projectType: formData.projectType,
        project_type: formData.projectType, // legacy compatibility
        totalAmount: calculateQuote(),
        total_amount: calculateQuote(), // legacy compatibility
        status: 'pending',
        createdAt: serverTimestamp(),
        created_at: serverTimestamp(), // legacy compatibility
        pdfUrl,
        pdf_url: pdfUrl, // legacy compatibility
        features: formData.features,
        hostingCost: formData.hostingCost,
        hosting_cost: formData.hostingCost, // legacy compatibility
        maintenanceCost: formData.maintenanceCost,
        maintenance_cost: formData.maintenanceCost, // legacy compatibility
      };
      
      await setDoc(quoteRef, quoteData);

      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        quoteId: quoteRef.id
      });

      toast.success("Quote generated successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error generating quote:", error);
      toast.error(`Failed to generate quote: ${message}`);
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
  // Calculate the original amount before discount
  const calculateOriginalAmount = () => {
    const baseQuote = formData.estimatedHours * formData.hourlyRate;
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[formData.complexity];
    const urgencyMultiplier = URGENCY_MULTIPLIERS[formData.urgency];
    
    // Calculate feature-based multipliers
    let featureMultiplier = 1;
    const selectedFeatures = features.filter((f: any) => formData.features.includes(f.name));
    selectedFeatures.forEach((feature: any) => {
      if (feature.multiplier) {
        featureMultiplier *= feature.multiplier;
      }
    });
    
    const originalQuote = baseQuote * complexityMultiplier * urgencyMultiplier * featureMultiplier;
    return originalQuote + formData.hostingCost + formData.maintenanceCost;
  };

  const originalAmount = calculateOriginalAmount();
  const savings = originalAmount - totalAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            {BRAND_LOGO_SRC ? <PdfImage src={BRAND_LOGO_SRC} style={styles.logo} /> : <View style={styles.logo} />}
            <Text style={styles.brandText}>VIRTARA CRM</Text>
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{company} {formData.documentType}</Text>
            <Text style={styles.subtitle}>
              Generated on {format(new Date(), 'MMMM dd, yyyy')}
            </Text>
            <View style={styles.chipRow}>
              <Text style={styles.chip}>{formData.projectType}</Text>
              <Text style={styles.chip}>{formData.urgency}</Text>
              <Text style={styles.chip}>{formData.complexity}</Text>
            </View>
          </View>
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
          <View style={styles.section}>
            <Text style={styles.label}>Features Required:</Text>
            {formData.features.map((featureName, index) => {
              const feature = features.find((f: any) => f.name === featureName);
              return (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.value}>
                    • {featureName}
                    {feature?.multiplier && (
                      <Text style={{ color: '#f9b17a', fontSize: 10 }}>
                        {' '}(+{Math.round((feature.multiplier - 1) * 100)}% complexity)
                      </Text>
                    )}
                  </Text>
                  {feature?.description && (
                    <Text style={styles.featureDescription}>
                      {feature.description}
                    </Text>
                  )}
                </View>
              );
            })}
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

        {/* Project Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Timeline</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Estimated Completion:</Text>
            <Text style={styles.value}>
              {formData.estimatedHours < 20 
                ? "2-5 weeks (estimate)" 
                : "5-10 weeks (estimate)"
              }
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Complexity Level:</Text>
            <Text style={styles.value}>
              {formData.complexity} ({COMPLEXITY_MULTIPLIERS[formData.complexity]}x multiplier)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Urgency Level:</Text>
            <Text style={styles.value}>
              {formData.urgency} ({URGENCY_MULTIPLIERS[formData.urgency]}x multiplier)
            </Text>
          </View>
        </View>

        {/* Discount Information */}
        {formData.discountType !== 'none' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Applied Discount</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Discount Type:</Text>
              <Text style={styles.value}>
                {formData.discountType === 'percentage' ? 'Percentage Discount'
                  : formData.discountType === 'hourly' ? 'Hourly Rate Discount'
                  : 'Hours Discount'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Discount Value:</Text>
              <Text style={styles.value}>
                {formData.discountType === 'percentage' ? `${formData.discountValue}%`
                  : formData.discountType === 'hourly' ? `R${formData.discountValue} per hour`
                  : `${formData.discountValue} hours`}
              </Text>
            </View>
          </View>
        )}

        {/* Show original amount and savings if there's a discount */}
        {formData.discountType !== 'none' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Breakdown</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Original Amount:</Text>
              <Text style={styles.value}>R{originalAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Savings:</Text>
              <Text style={styles.value}>R{savings.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Total */}
        <View style={styles.total}>
          <View style={styles.row}>
            <Text style={styles.totalText}>Final Amount:</Text>
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
