'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddCustomerModal } from "./add-customer-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    companyName: '',
    contactNumber: '',
    status: true
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customersData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        // Get all projects for this customer
        const projectsSnapshot = await getDocs(
          query(collection(db, "projects"), where("clientId", "==", doc.id))
        );
        
        // Calculate total spent from quotes linked to projects
        let totalSpent = 0;
        for (const projectDoc of projectsSnapshot.docs) {
          const quotesSnapshot = await getDocs(
            query(collection(db, "quotes"), 
              where("project_id", "==", projectDoc.id),
              where("status", "==", "accepted")
            )
          );
          
          totalSpent += quotesSnapshot.docs.reduce((sum, quote) => 
            sum + (quote.data().total_amount || 0), 0
          );
        }

        return {
          id: doc.id,
          ...doc.data(),
          totalSpent,
        };
      })) as Customer[];
      setCustomers(customersData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name,
      email: customer.email,
      companyName: customer.companyName,
      contactNumber: customer.contactNumber,
      status: customer.status
    });
    setEditDialogOpen(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      // @ts-expect-error doc throwing random error
      const customerRef = doc(db, "customers", editingCustomer.id);
      await updateDoc(customerRef, {
        name: editForm.name,
        email: editForm.email,
        companyName: editForm.companyName,
        contactNumber: editForm.contactNumber,
        status: editForm.status
      });
      
      await fetchCustomers();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating customer: ", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <>
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader>
          <CardTitle className="text-spaceText">Customer Overview</CardTitle>
          <CardDescription className="text-spaceAccent">
            A list of all customers and their current status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spaceText"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-spaceAlt">Name</TableHead>
                  <TableHead className="text-spaceAlt">Email</TableHead>
                  <TableHead className="text-spaceAlt">Company</TableHead>
                  <TableHead className="text-spaceAlt">Contact</TableHead>
                  <TableHead className="text-spaceAlt">Total Spent</TableHead>
                  <TableHead className="text-spaceAlt">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    className="hover:bg-spaceAlt cursor-pointer"
                    onClick={() => handleEditClick(customer)}
                  >
                    <TableCell className="text-spaceText">{customer.name}</TableCell>
                    <TableCell className="text-spaceText">{customer.email}</TableCell>
                    <TableCell className="text-spaceText">{customer.companyName}</TableCell>
                    <TableCell className="text-spaceText">{customer.contactNumber}</TableCell>
                    <TableCell className="text-spaceText">R {customer.totalSpent.toLocaleString()}</TableCell>
                    <TableCell className="text-spaceText">
                      <Badge variant={customer.status ? 'default' : 'secondary'}>
                        {customer.status ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <AddCustomerModal onCustomerAdded={() => fetchCustomers()} />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-spaceText">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Email</label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Company Name</label>
              <Input
                value={editForm.companyName}
                onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Contact Number</label>
              <Input
                value={editForm.contactNumber}
                onChange={(e) => setEditForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                className="bg-space1 border-spaceAccent text-spaceText"
              />
            </div>
            <div>
              <label className="text-spaceText">Status</label>
              <select
                value={editForm.status.toString()}
                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value === 'true' }))}
                className="flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <Button 
              onClick={handleUpdateCustomer}
              className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full"
            >
              Update Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}