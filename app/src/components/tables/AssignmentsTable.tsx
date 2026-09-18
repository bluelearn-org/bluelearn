import {
  reviewCaseTypeSchema,
  reviewSeatStatusSchema,
  userStatusSchema,
} from "@bluelearn/schemas";
import { useEffect, useState } from "react";
import { Checkbox } from "../ui/checkbox";
import type { AssignmentTable } from "@/lib/api/dashboard";
import type { DashboardColumn } from "@/lib/dashboardFilters";
import { useDashboardFilters } from "@/lib/dashboardFilters";
import { ColumnFilter } from "@/components/tables/ColumnFilter";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/guideUtils";
import { deadlineTickMs, formatTimeRemaining } from "@/lib/reviewDeadline";

type AssignmentsTableProps = {
  assignmentsData: AssignmentTable;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
};

const columns: Array<
  DashboardColumn<AssignmentTable[number]> & { width: string }
> = [
  {
    key: "username",
    label: "Assignee",
    width: "w-sm",
    value: (row) => row.username,
  },
  {
    key: "user_status",
    label: "Assignee Status",
    width: "w-xs",
    kind: "choice",
    options: [...userStatusSchema.options, "No status."],
    value: (row) => row.user_status ?? "No status.",
  },
  {
    key: "time_left",
    label: "Time Left",
    width: "w-sm",
    kind: "duration",
    value: (row) => row.time_left,
  },
  {
    key: "status",
    label: "Status",
    width: "w-xs",
    kind: "choice",
    options: reviewSeatStatusSchema.options,
    value: (row) => row.status,
  },
  {
    key: "type",
    label: "Type",
    width: "w-xs",
    kind: "choice",
    options: reviewCaseTypeSchema.options,
    value: (row) => row.type,
  },
  { key: "title", label: "Title", width: "w-lg", value: (row) => row.title },
  {
    key: "change_summary",
    label: "Change Summary",
    width: "w-lg",
    value: (row) => row.change_summary,
  },
  {
    key: "date_created",
    label: "Date Created",
    width: "w-sm",
    kind: "date",
    value: (row) => row.date_created,
  },
  {
    key: "date_updated",
    label: "Date Updated",
    width: "w-sm",
    kind: "date",
    value: (row) => row.date_updated,
  },
];

function ExpireCell({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : null;

  useEffect(() => {
    if (expiresMs === null) return;

    const diffMs = expiresMs - Date.now();

    if (diffMs <= 0) return;

    const timer = setTimeout(() => setNow(Date.now()), deadlineTickMs(diffMs));

    return () => clearTimeout(timer);
  }, [expiresMs, now]);

  if (expiresMs === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  const diffMs = expiresMs - now;

  if (diffMs < 0) {
    return <span className="font-mono text-xs text-destructive">Expired</span>;
  }

  return <span>{formatTimeRemaining(diffMs)}</span>;
}

export const AssignmentsTable = ({
  assignmentsData,
  selectedIds,
  setSelectedIds,
}: AssignmentsTableProps) => {
  function getSelectionKey(assignment: AssignmentTable[number]) {
    return `${assignment.id}:${assignment.panel_id}`;
  }

  const { filters, visibleRows, updateFilters } = useDashboardFilters(
    assignmentsData,
    columns,
    selectedIds,
    setSelectedIds,
    getSelectionKey
  );

  const allSelected =
    visibleRows.length > 0 &&
    visibleRows.every((assignment) =>
      selectedIds.has(getSelectionKey(assignment))
    );

  function toggleAssignment(assignment: AssignmentTable[number]) {
    const key = getSelectionKey(assignment);
    const next = new Set(selectedIds);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    setSelectedIds(next);
  }

  function toggleAll() {
    const next = new Set(selectedIds);

    if (allSelected) {
      // deselect every assignment currently displayed
      visibleRows.forEach((assignment) => {
        next.delete(getSelectionKey(assignment));
      });
    } else {
      // select every assignment currently displayed
      visibleRows.forEach((assignment) => {
        next.add(getSelectionKey(assignment));
      });
    }

    setSelectedIds(next);
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[1400px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 px-4 py-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all assignments"
              />
            </TableHead>

            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={`${column.width} px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase`}
              >
                <ColumnFilter
                  column={column}
                  filters={filters}
                  onChange={updateFilters}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {visibleRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={10}
                className="px-4 py-3 text-center text-muted-foreground"
              >
                No data matches these filters
              </TableCell>
            </TableRow>
          )}
          {visibleRows.map((assignment) => {
            const selectionKey = getSelectionKey(assignment);

            return (
              <TableRow key={`${assignment.id}:${assignment.panel_id}`}>
                <TableCell className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(selectionKey)}
                    onCheckedChange={() => toggleAssignment(assignment)}
                    aria-label={`Select ${assignment.username} - ${assignment.title}`}
                  />
                </TableCell>

                <TableCell className="w-[150px] px-4 py-3 whitespace-pre-line">
                  {assignment.username}
                </TableCell>

                <TableCell className="w-[170px] px-4 py-3">
                  <Badge
                    variant="outline"
                    className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                  >
                    {assignment.user_status ?? "No status."}
                  </Badge>
                </TableCell>

                <TableCell className="mono-micro w-[120px] px-4 py-3 whitespace-pre-line">
                  <ExpireCell expiresAt={assignment.time_left} />
                </TableCell>

                <TableCell className="w-[120px] px-4 py-3">
                  <Badge
                    variant="outline"
                    className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                  >
                    {assignment.status}
                  </Badge>
                </TableCell>

                <TableCell className="w-[120px] px-4 py-3 whitespace-pre-line">
                  {assignment.type}
                </TableCell>

                <TableCell className="w-[300px] max-w-[300px] px-4 py-3 break-words whitespace-normal">
                  {assignment.title}
                </TableCell>

                <TableCell className="w-[350px] max-w-[350px] px-4 py-3 break-words whitespace-normal">
                  {assignment.change_summary || "—"}
                </TableCell>

                <TableCell className="mono-micro w-[140px] px-4 py-3 whitespace-pre-line">
                  {formatDate(new Date(assignment.date_created))}
                </TableCell>

                <TableCell className="mono-micro w-[140px] px-4 py-3 whitespace-pre-line">
                  {formatDate(new Date(assignment.date_updated))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
