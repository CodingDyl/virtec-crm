'use client'

import { Customer } from '@/types/customer';
import { Badge } from "@/components/ui/badge";
import { formatRand } from '@/lib/maintenance';
import { Mail, Phone, Building2, Trash2, Pencil, Wrench } from 'lucide-react';

interface CustomerHeaderProps {
  customer: Customer;
  projectCount: number;
  activeCount: number;
  outstandingQuoteCount: number;
  /** Lifetime maintenance position across every maintenance project they own. */
  maintenance: { totalPaid: number; outstanding: number; cadence: string | null } | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerHeader({
  customer,
  projectCount,
  activeCount,
  outstandingQuoteCount,
  maintenance,
  onEdit,
  onDelete,
}: CustomerHeaderProps) {
  const displayName = customer.companyName || customer.name;
  const iconButton =
    "rounded-md p-1.5 text-spaceAlt/70 transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2";

  return (
    <div className="rounded-xl border border-spaceAccent/30 bg-space1/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-spaceText">{displayName}</p>
          <p className="truncate text-sm text-spaceAlt/80">{customer.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={customer.status ? 'default' : 'secondary'}>
            {customer.status ? 'Active' : 'Inactive'}
          </Badge>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit customer ${displayName}`}
            title="Edit customer"
            className={`${iconButton} hover:bg-spaceAccent/15 hover:text-spaceAccent focus-visible:ring-spaceAccent`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete customer ${displayName}`}
            title="Delete customer"
            className={`${iconButton} hover:bg-red-500/15 hover:text-red-300 focus-visible:ring-red-400`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
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

      {maintenance && (
        <div className="rounded-lg border border-spaceAccent/25 bg-space2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-spaceAlt/70">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              Maintenance paid
            </p>
            {maintenance.cadence && (
              <span className="rounded-full border border-spaceAccent/30 px-2 py-0.5 text-[10px] text-spaceAlt/90">
                {maintenance.cadence}
              </span>
            )}
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-spaceAccent">
            {formatRand(maintenance.totalPaid)}
          </p>
          {maintenance.outstanding > 0 && (
            <p className="mt-0.5 text-xs text-yellow-300/90">
              {formatRand(maintenance.outstanding)} outstanding
            </p>
          )}
        </div>
      )}

      <div className="space-y-1 text-sm text-spaceAlt/90">
        {customer.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{customer.email}</span></p>}
        {customer.contactNumber && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.contactNumber}</p>}
        {customer.companyName && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 shrink-0" />{customer.companyName}</p>}
      </div>
    </div>
  );
}
