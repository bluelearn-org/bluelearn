import {
  applicableRoleSchema,
  roleApplicationStatusSchema,
} from "@bluelearn/schemas";
import { Checkbox } from "../ui/checkbox";
import type { RoleApplicationRow } from "@/lib/api/dashboard";
import type { DashboardColumn, DashboardFilters } from "@/lib/dashboardFilters";
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

type RoleApplicationsTableProps = {
  applications: Array<RoleApplicationRow>;
  filters: DashboardFilters;
  onFiltersChange: (changes: DashboardFilters) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
};

export const roleApplicationColumns: Array<DashboardColumn> = [
  { key: "username", label: "Username" },
  {
    key: "role",
    label: "Role",
    kind: "choice",
    options: [...applicableRoleSchema.options],
  },
  {
    key: "status",
    label: "Status",
    kind: "choice",
    options: [...roleApplicationStatusSchema.options],
  },
  { key: "statement", label: "Statement" },
  { key: "date_created", label: "Applied", kind: "date" },
  { key: "date_decided", label: "Decided", kind: "date" },
];

const BADGE_CLASS =
  "mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground";

// Only a pending application can still be decided, so only those rows select.
const isPending = (row: RoleApplicationRow) => row.status === "pending";

export const RoleApplicationsTable = ({
  applications,
  filters,
  onFiltersChange,
  selectedIds,
  setSelectedIds,
}: RoleApplicationsTableProps) => {
  const pending = applications.filter(isPending);
  const allSelected =
    pending.length > 0 && pending.every((row) => selectedIds.has(row.id));

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      pending.forEach((row) => next.delete(row.id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set(pending.map((row) => row.id)));
    }
  }

  return (
    <Table className="mx-auto w-full max-w-5xl">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-4 py-3">
            <Checkbox
              checked={allSelected}
              disabled={pending.length === 0}
              onCheckedChange={toggleAll}
              aria-label="Select all pending applications"
            />
          </TableHead>

          {roleApplicationColumns.map((column) => (
            <TableHead
              key={column.key}
              className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase"
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
        {applications.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={7}
              className="px-4 py-3 text-center text-muted-foreground"
            >
              No data matches these filters
            </TableCell>
          </TableRow>
        )}

        {applications.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="w-12 px-4 py-3">
              <Checkbox
                checked={selectedIds.has(row.id)}
                disabled={!isPending(row)}
                onCheckedChange={() => toggleRow(row.id)}
                aria-label={`Select ${row.username}`}
              />
            </TableCell>

            <TableCell className="px-4 py-3 whitespace-nowrap">
              {row.username}
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge variant="outline" className={BADGE_CLASS}>
                {row.role}
              </Badge>
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge variant="outline" className={BADGE_CLASS}>
                {row.status}
              </Badge>
            </TableCell>

            <TableCell className="max-w-sm px-4 py-3 break-words whitespace-pre-line">
              {row.statement || "—"}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {formatDate(new Date(row.date_created))}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {row.date_decided ? (
                <>
                  {formatDate(new Date(row.date_decided))}
                  {row.decided_by && (
                    <span className="block text-muted-foreground">
                      by {row.decided_by}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
