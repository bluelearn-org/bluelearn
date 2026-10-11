import { userStatusSchema } from "@bluelearn/schemas";
import { Checkbox } from "../ui/checkbox";
import type { MemberRow } from "@/lib/api/dashboard";
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

type MembersTableProps = {
  MemberData: Array<MemberRow>;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
};

const columns: Array<DashboardColumn<MemberRow>> = [
  { key: "username", label: "Username", value: (row) => row.username },
  {
    key: "display_name",
    label: "Display Name",
    value: (row) => row.display_name ?? row.username,
  },
  { key: "bio", label: "Bio", value: (row) => row.bio },
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
    options: [...userStatusSchema.options, "No Status"],
    value: (row) => row.status ?? "No Status",
  },
];

export const MembersTable = ({
  MemberData,
  selectedIds,
  setSelectedIds,
}: MembersTableProps) => {
  const {
    filters,
    visibleRows: profiles,
    updateFilters,
  } = useDashboardFilters(
    MemberData,
    columns,
    selectedIds,
    setSelectedIds,
    (row) => row.id
  );
  const allSelected =
    profiles.length > 0 &&
    profiles.every((profile: MemberRow) => selectedIds.has(profile.id));

  function toggleProfile(profileId: string) {
    const next = new Set(selectedIds);
    if (next.has(profileId)) {
      next.delete(profileId);
    } else {
      next.add(profileId);
    }
    setSelectedIds(next);
  }

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      profiles.forEach((profile: MemberRow) => next.delete(profile.id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set(profiles.map((profile: MemberRow) => profile.id)));
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
        {profiles.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={7}
              className="px-4 py-3 text-center text-muted-foreground"
            >
              No data matches these filters
            </TableCell>
          </TableRow>
        )}
        {profiles.map((profile: MemberRow) => (
          <TableRow key={profile.id}>
            <TableCell className="w-12 px-4 py-3">
              <Checkbox
                checked={selectedIds.has(profile.id)}
                onCheckedChange={() => toggleProfile(profile.id)}
                aria-label={`Select ${profile.username}`}
              />
            </TableCell>

            <TableCell className="px-4 py-3 whitespace-nowrap">
              {profile.username}
            </TableCell>

            <TableCell className="px-4 py-3 whitespace-nowrap">
              {profile.display_name ?? profile.username}
            </TableCell>

            <TableCell className="max-w-sm px-4 py-3 break-words whitespace-pre-line">
              {profile.bio || "—"}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {formatDate(new Date(profile.date_created))}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {formatDate(new Date(profile.date_updated))}
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {profile.status ?? "No Status"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
