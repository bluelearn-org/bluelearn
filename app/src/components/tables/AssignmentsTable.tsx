import { useEffect, useState } from "react";
import { Checkbox } from "../ui/checkbox";
import type { AssignmentTable } from "@/lib/api/dashboard";
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

  if (expiresMs === null)
    return <span className="text-muted-foreground">-</span>;

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
  const allSelected =
    assignmentsData.length > 0 &&
    assignmentsData.every((assignment) =>
      selectedIds.has(getSelectionKey(assignment))
    );

  function getSelectionKey(assignment: AssignmentTable[number]) {
    return `${assignment.id}:${assignment.panel_id}`;
  }

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
    if (allSelected) {
      const next = new Set(selectedIds);
      assignmentsData.forEach((assignment: any) => next.delete(assignment.id));
      setSelectedIds(next);
    }

    setSelectedIds(
      new Set(assignmentsData.map((assignment: any) => assignment.id))
    );
  }

  return (
    <Table className="mx-auto w-full max-w-5xl">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-4 py-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all users"
            />
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Assignee
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Assignee Status
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Time Left
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Status
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Type
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Title
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Change Summary
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Date Created
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Date Updated
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {assignmentsData.map((assignment: any) => {
          console.log(assignment);
          return (
            <TableRow key={`${assignment.username} - ${assignment.title}`}>
              <TableCell className="w-12 px-4 py-3">
                <Checkbox
                  checked={selectedIds.has(getSelectionKey(assignment))}
                  onCheckedChange={() => toggleAssignment(assignment)}
                  aria-label={`Select ${assignment.username} - ${assignment.title}`}
                />
              </TableCell>

              <TableCell className="px-4 py-3 whitespace-nowrap">
                {assignment.username}
              </TableCell>

              <TableCell className="flex max-w-xs flex-wrap gap-2 px-4 py-3">
                <Badge
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {assignment.user_status ?? "No status."}
                </Badge>
              </TableCell>

              <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
                <ExpireCell expiresAt={assignment.time_left} />
              </TableCell>

              <TableCell className="flex max-w-xs flex-wrap gap-2 px-4 py-3">
                <Badge
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {assignment.status}
                </Badge>
              </TableCell>

              <TableCell className="px-4 py-3 whitespace-nowrap">
                {assignment.type}
              </TableCell>

              <TableCell className="max-w-xs px-4 py-3 whitespace-nowrap">
                {assignment.title}
              </TableCell>

              <TableCell className="max-w-xs px-4 py-3 whitespace-nowrap">
                {assignment.change_summary ?? ""}
              </TableCell>

              <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
                {formatDate(new Date(assignment.date_created))}
              </TableCell>

              <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
                {formatDate(new Date(assignment.date_updated))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
