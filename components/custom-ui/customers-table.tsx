'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { customers } from "@/constants";    
import { AddCustomerModal } from "./add-customer-modal"

export default function CustomersTable() {
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-spaceAlt">Name</TableHead>
                <TableHead className="text-spaceAlt">Email</TableHead>
                <TableHead className="text-spaceAlt">Total Spent</TableHead>
                <TableHead className="text-spaceAlt">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.email} className="hover:bg-spaceAccent">
                  <TableCell className="text-spaceText">{customer.name}</TableCell>
                  <TableCell className="text-spaceText">{customer.email}</TableCell>
                  <TableCell className="text-spaceText">${customer.totalSpent.toLocaleString()}</TableCell>
                  <TableCell className="text-spaceText">
                    <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddCustomerModal />
    </>
  );
}