import { useEffect, useMemo, useState } from 'react';

interface UsePaginationOptions {
  initialPageSize?: number;
  /** When this value changes (e.g. active filters/search), jump back to page 1. */
  resetKey?: unknown;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { initialPageSize = 10, resetKey } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Jump back to the first page whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  // Keep the current page in range if the data shrinks.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, pageSize]);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return { page, setPage, pageSize, setPageSize, total, totalPages, pageItems, start, end };
}
