import { Pagination } from "@/components/Pagination";
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboardFilters";

type DashboardPaginationProps = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function DashboardPagination({
  page,
  total,
  onPageChange,
}: DashboardPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE));
  // A stale or hand-typed page past the end still gets a way back.
  const current = Math.min(page, totalPages);

  if (totalPages === 1 && page === 1) return null;

  return (
    <Pagination
      activePageNo={current}
      onPageSelect={onPageChange}
      toFirst={() => onPageChange(1)}
      onPrevious={() => onPageChange(Math.max(1, current - 1))}
      onNext={() => onPageChange(Math.min(totalPages, current + 1))}
      toLast={() => onPageChange(totalPages)}
      totalPages={totalPages}
    />
  );
}
