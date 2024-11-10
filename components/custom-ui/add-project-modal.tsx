'use client'

import { useState, useEffect } from "react"
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
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
    completion: 0
  });

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
      await addDoc(collection(db, "projects"), {
        ...formData,
        clientName: selectedCustomer?.companyName,
        createdAt: new Date()
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
        <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-spaceAccent hover:bg-spaceAlt">
          <PlusCircle className="h-6 w-6" />
        </Button>
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
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
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
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
            >
              <option value="">Select a client</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select 
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
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
              className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spaceAccent focus:ring-offset-2"
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