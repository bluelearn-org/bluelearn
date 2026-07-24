import { useState } from "react";

type Controlled = {
  page: number;
  onPageChange: (page: number) => void;
};

// Pass a controlled pair when the page lives outside the hook (e.g. URL
// search params). Leave it out and the hook keeps the page itself.
export function usePagination<T>(
  items: Array<T>,
  pageSize: number,
  controlled?: Controlled
) {
  const [localPage, setLocalPage] = useState(1);
  const page = controlled?.page ?? localPage;
  const setPage = controlled?.onPageChange ?? setLocalPage;
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
