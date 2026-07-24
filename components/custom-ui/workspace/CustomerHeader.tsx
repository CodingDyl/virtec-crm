'use client'

import { Customer } from '@/types/customer';
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2 } from 'lucide-react';

interface CustomerHeaderProps {
  customer: Customer;
  projectCount: number;
  activeCount: number;
  outstandingQuoteCount: number;
}

export function CustomerHeader({ customer, projectCount, activeCount, outstandingQuoteCount }: CustomerHeaderProps) {
  return (
    <div className="rounded-xl border border-spaceAccent/30 bg-space1/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-spaceText">{customer.companyName || customer.name}</p>
          <p className="truncate text-sm text-spaceAlt/80">{customer.name}</p>
        </div>
        <Badge variant={customer.status ? 'default' : 'secondary'}>
          {customer.status ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-spaceText">R{(customer.totalSpent ?? 0).toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Total value</p>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-spaceText">{activeCount}<span className="text-spaceAlt/60 text-sm">/{projectCount}</span></p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Active proj.</p>
        </div>
        <div className="rounded-lg bg-space2/70 py-2">
          <p className="text-lg font-bold text-yellow-400">{outstandingQuoteCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-spaceAlt/70">Pending quotes</p>
        </div>
      </div>

      <div className="space-y-1 text-sm text-spaceAlt/90">
        {customer.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{customer.email}</span></p>}
        {customer.contactNumber && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.contactNumber}</p>}
        {customer.companyName && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 shrink-0" />{customer.companyName}</p>}
      </div>
    </div>
  );
}
