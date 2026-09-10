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

  const allSelected =
    assignmentsData.length > 0 &&
    assignmentsData.every((assignment) =>
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
      assignmentsData.forEach((assignment) => {
        next.delete(getSelectionKey(assignment));
      });
    } else {
      // select every assignment currently displayed
      assignmentsData.forEach((assignment) => {
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

            <TableHead className="w-sm px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Assignee
            </TableHead>

            <TableHead className="w-xs px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Assignee Status
            </TableHead>

            <TableHead className="w-sm px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Time Left
            </TableHead>

            <TableHead className="w-xs px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Status
            </TableHead>

            <TableHead className="w-xs px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Type
            </TableHead>

            <TableHead className="w-lg px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Title
            </TableHead>

            <TableHead className="w-lg px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Change Summary
            </TableHead>

            <TableHead className="w-sm px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Date Created
            </TableHead>

            <TableHead className="w-sm px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
              Date Updated
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {assignmentsData.map((assignment) => {
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
