"use client";

import * as React from "react";

export function usePagination<T>(items: T[], pageSize = 8) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clamped = Math.min(page, totalPages);
  const paged = React.useMemo(() => {
    const start = (clamped - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, clamped, pageSize]);
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  return { page: clamped, totalPages, paged, setPage, total: items.length };
}
