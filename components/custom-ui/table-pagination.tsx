'use client'

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

/** Build a compact list of page tokens: numbers and "…" gaps. */
function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const tokens: (number | 'gap')[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) tokens.push('gap');
  for (let i = left; i <= right; i++) tokens.push(i);
  if (right < totalPages - 1) tokens.push('gap');
  tokens.push(totalPages);
  return tokens;
}

export function TablePagination({
  page,
  totalPages,
  total,
  start,
  end,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'items',
}: TablePaginationProps) {
  const tokens = pageWindow(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-spaceAccent/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <p className="text-sm text-spaceAlt/90">
          {total === 0 ? `No ${itemLabel}` : <>Showing <span className="text-spaceText">{start}</span>–<span className="text-spaceText">{end}</span> of <span className="text-spaceText">{total}</span></>}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-spaceAlt/70">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-spaceAccent/35 bg-space1/85 px-2 text-sm text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 p-0 border-spaceAccent/40 bg-space1/70 text-spaceText hover:bg-space1 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {tokens.map((token, i) =>
          token === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-spaceAlt/60">…</span>
          ) : (
            <Button
              key={token}
              variant="outline"
              size="sm"
              onClick={() => onPageChange(token)}
              aria-current={token === page ? 'page' : undefined}
              className={
                token === page
                  ? 'h-8 min-w-8 px-2 border-spaceAccent bg-spaceAccent text-space1 hover:bg-spaceAccent'
                  : 'h-8 min-w-8 px-2 border-spaceAccent/40 bg-space1/70 text-spaceText hover:bg-space1'
              }
            >
              {token}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8 p-0 border-spaceAccent/40 bg-space1/70 text-spaceText hover:bg-space1 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
