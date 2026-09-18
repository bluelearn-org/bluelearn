import { userRoleSchema, userStatusSchema } from "@bluelearn/schemas";
import { Checkbox } from "../ui/checkbox";
import type { DashboardRoleRow } from "@/lib/api/dashboard";
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

type RolesTableProps = {
  roleData: DashboardRoleRow;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
};

const columns: Array<DashboardColumn<DashboardRoleRow[number]>> = [
  { key: "username", label: "Username", value: (row) => row.username },
  {
    key: "roles",
    label: "Roles",
    kind: "choice",
    options: [...userRoleSchema.options, "No roles"],
    value: (row) => (row.roles.length ? row.roles : ["No roles"]),
  },
  {
    key: "date_created",
    label: "Date Created",
    kind: "date",
    value: (row) => row.date_created,
  },
  {
    key: "date_updated",
    label: "Date Updated",
    kind: "date",
    value: (row) => row.date_updated,
  },
  {
    key: "status",
    label: "Status",
    kind: "choice",
    options: [...userStatusSchema.options, "No status"],
    value: (row) => row.status ?? "No status",
  },
];

export const RolesTable = ({
  roleData,
  selectedIds,
  setSelectedIds,
}: RolesTableProps) => {
  const { filters, visibleRows, updateFilters } = useDashboardFilters(
    roleData,
    columns,
    selectedIds,
    setSelectedIds,
    (row) => row.id
  );
  const allSelected =
    visibleRows.length > 0 &&
    visibleRows.every((profile) => selectedIds.has(profile.id));

  function toggleUser(userId: string) {
    const next = new Set(selectedIds);

    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedIds(next);
  }

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      visibleRows.forEach((user) => next.delete(user.id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set(visibleRows.map((user) => user.id)));
    }
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

          {columns.map((column) => (
            <TableHead
              key={column.key}
              className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase"
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
              colSpan={6}
              className="px-4 py-3 text-center text-muted-foreground"
            >
              No data matches these filters
            </TableCell>
          </TableRow>
        )}
        {visibleRows.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="w-12 px-4 py-3">
              <Checkbox
                checked={selectedIds.has(user.id)}
                onCheckedChange={() => toggleUser(user.id)}
                aria-label={`Select ${user.username}`}
              />
            </TableCell>

            <TableCell className="px-4 py-3 whitespace-nowrap">
              {user.username}
            </TableCell>

            <TableCell className="flex max-w-xs flex-wrap gap-2 px-4 py-3">
              {user.roles.map((role: string, i: number) => (
                <Badge
                  key={role + i}
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {role}
                </Badge>
              ))}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {formatDate(new Date(user.date_created))}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {formatDate(new Date(user.date_updated))}
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {user.status ?? "No status"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
