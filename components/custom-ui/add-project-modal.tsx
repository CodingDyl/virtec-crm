'use client'

import { useState, useEffect } from "react"
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { MaintenanceFrequency } from '@/types/maintenance';
import { DEFAULT_MAINTENANCE_FREQUENCY, MAINTENANCE_FREQUENCIES } from '@/lib/maintenance';
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle } from "lucide-react"

export function AddProjectModal({ onProjectAdded }: { onProjectAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    projectType: '',
    clientId: '',
    status: 'active',
    quoteId: '',
    amount: 0,
    completion: 0,
    maintenanceFrequency: DEFAULT_MAINTENANCE_FREQUENCY as MaintenanceFrequency,
    maintenanceAmount: 0,
  });

  const isMaintenance = formData.projectType === 'Maintenance';

  const projectTypes = [
    'Website Redesign',
    'Full Website Build',
    'SEO Campaign',
    'E-commerce',
    'Admin Panel',
    'CRM System',
    'Maintenance',
    'Other'
  ];

  useEffect(() => {
    const fetchCustomers = async () => {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersData);
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedCustomer = customers.find(c => c.id === formData.clientId);
      const { maintenanceFrequency, maintenanceAmount, ...base } = formData;
      await addDoc(collection(db, "projects"), {
        ...base,
        // Only maintenance projects carry a billing cycle.
        ...(isMaintenance ? { maintenanceFrequency, maintenanceAmount } : {}),
        clientName: selectedCustomer?.companyName,
        createdAt: serverTimestamp()
      });
      setOpen(false);
      onProjectAdded();
    } catch (error) {
      console.error("Error adding project: ", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-space2 text-spaceText border-spaceAccent border-2 hover:bg-spaceAlt">Add A New Project</Button>
      </DialogTrigger>
      <DialogContent className="bg-space2 text-spaceText border-spaceAccent">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="projectType">Project Type</Label>
            <select 
              id="projectType"
              value={formData.projectType}
              onChange={(e) => setFormData({...formData, projectType: e.target.value})}
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
            >
              <option value="">Select a project type</option>
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="client">Client</Label>
            <select 
              id="client"
              value={formData.clientId}
              onChange={(e) => setFormData({...formData, clientId: e.target.value})}
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
            >
              <option value="">Select a client</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </div>
          {isMaintenance && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-spaceAccent/25 bg-space1/40 p-3">
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide text-spaceAlt/80">Recurring billing</p>
              </div>
              <div>
                <Label htmlFor="maintenanceFrequency">Payment frequency</Label>
                <select
                  id="maintenanceFrequency"
                  value={formData.maintenanceFrequency}
                  onChange={(e) => setFormData({ ...formData, maintenanceFrequency: e.target.value as MaintenanceFrequency })}
                  className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
                >
                  {MAINTENANCE_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="maintenanceAmount">Amount per cycle (R)</Label>
                <Input
                  id="maintenanceAmount"
                  type="text"
                  inputMode="numeric"
                  value={formData.maintenanceAmount}
                  onChange={(e) => setFormData({ ...formData, maintenanceAmount: e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, '')) : 0 })}
                  className="bg-space1 border-spaceAccent text-spaceText"
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="status">Status</Label>
            <select 
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value ? Number(e.target.value) : 0})}
              className="bg-space1 border-spaceAccent text-spaceText"
            />
          </div>
          <div>
            <Label htmlFor="completion">Completion Percentage</Label>
            <select 
              id="completion"
              value={formData.completion}
              onChange={(e) => setFormData({...formData, completion: Number(e.target.value)})}
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
            >
              <option value="0">0%</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
            </select>
          </div>
          <Button type="submit" className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full">
            Add Project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
} 
