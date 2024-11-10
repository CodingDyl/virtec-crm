'use client'

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddCustomerModal } from "./add-customer-modal"

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customersData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        // Get all projects for this customer
        const projectsSnapshot = await getDocs(
          query(collection(db, "projects"), where("customerId", "==", doc.id))
        );
        
        // Calculate total spent from projects
        const totalSpent = projectsSnapshot.docs.reduce((sum, project) => {
          return sum + (project.data().amount || 0);
        }, 0);

        return {
          id: doc.id,
          ...doc.data(),
          totalSpent, // Override any existing totalSpent with calculated value
        };
      })) as Customer[];
      setCustomers(customersData);
    } finally {
      setIsLoading(false);
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
                  <TableRow key={customer.id} className="hover:bg-spaceAccent">
                    <TableCell className="text-spaceText">{customer.name}</TableCell>
                    <TableCell className="text-spaceText">{customer.email}</TableCell>
                    <TableCell className="text-spaceText">{customer.companyName}</TableCell>
                    <TableCell className="text-spaceText">{customer.contactNumber}</TableCell>
                    <TableCell className="text-spaceText">${customer.totalSpent.toLocaleString()}</TableCell>
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
    </>
  );
}