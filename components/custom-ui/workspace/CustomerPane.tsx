'use client'

import { useMemo, useState } from 'react';
import { Customer } from '@/types/customer';
import { Input } from "@/components/ui/input";
import { AddCustomerModal } from "../add-customer-modal";
import { Search } from 'lucide-react';

interface CustomerPaneProps {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function CustomerPane({ customers, selectedCustomerId, onSelect, onRefresh }: CustomerPaneProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter((c) =>
      `${c.name} ${c.companyName} ${c.email}`.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-spaceText">Customers</p>
        <AddCustomerModal onCustomerAdded={onRefresh} />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spaceAlt/80" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-spaceAlt/70">No customers found.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={c.id === selectedCustomerId}
              onClick={() => c.id && onSelect(c.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                c.id === selectedCustomerId
                  ? 'border border-spaceAccent bg-spaceAccent/15 text-spaceText'
                  : 'text-spaceAlt hover:bg-space1/70 hover:text-spaceText'
              }`}
            >
              <span className="block truncate font-medium">{c.companyName || c.name}</span>
              <span className="block truncate text-xs text-spaceAlt/70">{c.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
