'use client'

import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Customer } from '@/types/customer';
import { useCustomers } from '@/contexts/DataContexts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddCustomerModal } from "./add-customer-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Quantum } from 'ldrs/react';
import 'ldrs/react/Quantum.css';
import { Search } from 'lucide-react';
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "./table-pagination";

export default function CustomersTable() {
  const { customers, isLoading, refreshData, lastUpdated } = useCustomers();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    companyName: '',
    contactNumber: '',
    status: true
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const text = `${customer.name} ${customer.email} ${customer.companyName} ${customer.contactNumber}`.toLowerCase();
      const matchesSearch = text.includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && customer.status) ||
        (statusFilter === 'inactive' && !customer.status);
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  const {
    page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end,
  } = usePagination(filteredCustomers, { resetKey: `${searchTerm}|${statusFilter}` });

  const getLastUpdatedText = () => {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return lastUpdated.toLocaleDateString();
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
    if (!editingCustomer?.id) return;

    try {
      const customerRef = doc(db, "customers", editingCustomer.id);
      await updateDoc(customerRef, {
        name: editForm.name,
        email: editForm.email,
        companyName: editForm.companyName,
        contactNumber: editForm.contactNumber,
        status: editForm.status
      });

      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating customer: ", error);
    }
  };

  return (
    <>
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-spaceText">Customer Overview</CardTitle>
              <CardDescription className="text-spaceAccent">
                Last updated: {getLastUpdatedText()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={refreshData} variant="outline" className="h-10 border-spaceAccent/40 bg-space1/70 text-spaceText hover:bg-space1">
                Refresh
              </Button>
              <AddCustomerModal onCustomerAdded={refreshData} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spaceAlt/80" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, company, email, or contact number"
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="h-10 rounded-xl border border-spaceAccent/35 bg-space1/85 px-3 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="min-h-[420px] w-full flex flex-col items-center justify-center p-8 gap-4">
              <Quantum size="100" speed="1.75" color="white" />
              <p className="text-spaceText">Fetching customers...</p>
            </div>
          ) : (
            <div className="rounded-xl border border-spaceAccent/25 overflow-hidden">
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
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-spaceAlt">
                        No customers match your current search/filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-space1/70"
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
                    ))
                  )}
                </TableBody>
              </Table>
              {total > 0 && (
                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  start={start}
                  end={end}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="customers"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
