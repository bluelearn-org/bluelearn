import { useState } from "react";

export function usePagination<T>(items: Array<T>, pageSize: number) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const goToPage = (pageNo: number) =>
    setPage(Math.min(Math.max(pageNo, 1), totalPages));

  return {
    page: current,
    totalPages,
    pageRows: items.slice(start, start + pageSize),
    start,
    goToPage,
    toFirst: () => goToPage(1),
    onPrevious: () => goToPage(current - 1),
    onNext: () => goToPage(current + 1),
    toLast: () => goToPage(totalPages),
  };
}
