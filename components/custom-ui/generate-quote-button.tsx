'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { db } from '@/firebase/firebaseConfig';
import { collection, doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
// @ts-ignore
import { uploadFile } from '@/lib/storage-client';
import { toast } from "sonner"
import { Project } from '@/types/project';
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
  const [clientId, setClientId] = useState('');
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
          const resolvedClientId = String(projectData.clientId ?? projectData.client_id ?? '').trim();
          setClientId(resolvedClientId);
          
          // Fetch client data using clientId from project data
          if (!resolvedClientId) {
            setClientData(null);
            return;
          }

          const clientDoc = await getDoc(doc(db, "customers", resolvedClientId));
          if (clientDoc.exists()) {
            setClientData(clientDoc.data());
          } else {
            setClientData(null);
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
      const totalAmount = calculateQuote();
      const pdfResponse = await fetch('/api/quote-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          formData,
          totalAmount,
          clientData: {
            name: clientData?.name || '',
            companyName: clientData?.companyName || '',
            contactNumber: clientData?.contactNumber || '',
            email: clientData?.email || '',
          },
        }),
      });
      if (!pdfResponse.ok) {
        throw new Error(`PDF generation failed with status ${pdfResponse.status}`);
      }
      const pdfBlob = await pdfResponse.blob();
      
      // Create a sanitized client name for the file name
      const sanitizedClientName = clientData?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown_client';
      const pdfPath = await uploadFile(pdfBlob, 'quotes', `${sanitizedClientName}_${quoteRef.id}_quote.pdf`);
      
      const quoteData = {
        ...formData,
        clientId,
        client_id: clientId, // legacy compatibility
        projectId,
        project_id: projectId, // legacy compatibility
        projectType: formData.projectType,
        project_type: formData.projectType, // legacy compatibility
        totalAmount,
        total_amount: totalAmount, // legacy compatibility
        status: 'pending',
        createdAt: serverTimestamp(),
        created_at: serverTimestamp(), // legacy compatibility
        pdfPath,
        company,
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
