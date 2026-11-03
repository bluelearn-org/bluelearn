import type { DashboardSubject } from "@bluelearn/schemas";
import type { DashboardColumn, DashboardFilters } from "@/lib/dashboardFilters";
import { formatDate } from "@/lib/guideUtils";
import { ColumnFilter } from "@/components/tables/ColumnFilter";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const subjectColumns: Array<DashboardColumn> = [
  { key: "name", label: "Name" },
  { key: "summary", label: "Summary" },
  { key: "date_created", label: "Date Created", kind: "date" },
];

export function SubjectsTable({
  subjects,
  filters,
  onFiltersChange,
  selectedIds,
  setSelectedIds,
}: {
  subjects: Array<DashboardSubject>;
  filters: DashboardFilters;
  onFiltersChange: (changes: DashboardFilters) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}) {
  const allSelected =
    subjects.length > 0 && subjects.every(({ id }) => selectedIds.has(id));
  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }
  return (
    <Table className="min-w-[650px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-4 py-3">
            <Checkbox
              aria-label="Select all subjects on this page"
              checked={allSelected}
              disabled={subjects.length === 0}
              onCheckedChange={() =>
                setSelectedIds(
                  allSelected
                    ? new Set()
                    : new Set(subjects.map(({ id }) => id))
                )
              }
            />
          </TableHead>
          {subjectColumns.map((column) => (
            <TableHead
              key={column.key}
              className="px-4 py-3 font-mono text-sm font-bold uppercase"
            >
              <ColumnFilter
                column={column}
                filters={filters}
                onChange={onFiltersChange}
              />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {subjects.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={4}
              className="py-6 text-center text-muted-foreground"
            >
              No subjects match these filters.
            </TableCell>
          </TableRow>
        )}
        {subjects.map((subject) => (
          <TableRow key={subject.id}>
            <TableCell className="px-4 py-3">
              <Checkbox
                aria-label={`Select ${subject.name}`}
                checked={selectedIds.has(subject.id)}
                onCheckedChange={() => toggle(subject.id)}
              />
            </TableCell>
            <TableCell className="max-w-64 px-4 py-3 break-words whitespace-normal">
              {subject.name}{" "}
              {subject.status === "draft" && (
                <Badge variant="outline">Draft</Badge>
              )}
            </TableCell>
            <TableCell className="max-w-md px-4 py-3 break-words whitespace-normal">
              {subject.summary || "No summary"}
            </TableCell>
            <TableCell className="px-4 py-3">
              {formatDate(new Date(subject.date_created))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
