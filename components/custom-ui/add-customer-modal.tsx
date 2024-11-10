'use client'

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';

interface AddCustomerModalProps {
  onCustomerAdded: () => void;
}

export function AddCustomerModal({ onCustomerAdded }: AddCustomerModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    email: '',
    companyName: '',
    contactNumber: '',
    totalSpent: 0,
    maintenance: false,
    status: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "customers"), formData);
      setOpen(false);
      onCustomerAdded();
      setFormData({
        name: '',
        email: '',
        companyName: '',
        contactNumber: '',
        totalSpent: 0,
        maintenance: false,
        status: true,
      });
    } catch (error) {
      console.error("Error adding customer: ", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-space2 text-spaceText border-spaceAccent border-2 hover:bg-spaceAlt">Add Customer</Button>
      </DialogTrigger>
      <DialogContent className="bg-space2 border-spaceAccent">
        <DialogHeader>
          <DialogTitle className="text-spaceText">Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-spaceText">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-space1 text-spaceText"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-spaceText">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="bg-space1 text-spaceText"
            />
          </div>
          <div>
            <Label htmlFor="companyName" className="text-spaceText">Company Name</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              className="bg-space1 text-spaceText"
            />
          </div>
          <div>
            <Label htmlFor="contactNumber" className="text-spaceText">Contact Number</Label>
            <Input
              id="contactNumber"
              value={formData.contactNumber}
              onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
              className="bg-space1 text-spaceText"
            />
          </div>
          <div>
            <Label htmlFor="totalSpent" className="text-spaceText">Total Spent</Label>
            <Input
              id="totalSpent"
              type="number"
              value={formData.totalSpent}
              onChange={(e) => setFormData({...formData, totalSpent: Number(e.target.value)})}
              className="bg-space1 text-spaceText"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="maintenance"
              checked={formData.maintenance}
              onCheckedChange={(checked) => setFormData({...formData, maintenance: checked as boolean})}
            />
            <Label htmlFor="maintenance" className="text-spaceText">Maintenance</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="status"
              checked={formData.status}
              onCheckedChange={(checked) => setFormData({...formData, status: checked as boolean})}
            />
            <Label htmlFor="status" className="text-spaceText">Active Status</Label>
          </div>
          <Button type="submit" className="w-full">Add Customer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 