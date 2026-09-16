import { Checkbox } from "../ui/checkbox";
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
  roleData: Array<any>;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
};

export const RolesTable = ({
  roleData,
  selectedIds,
  setSelectedIds,
}: RolesTableProps) => {
  const allSelected =
    roleData.length > 0 &&
    roleData.every((profile: any) => selectedIds.has(profile.id));

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
      roleData.forEach((user: any) => next.delete(user.id));
      setSelectedIds(next);
    }

    setSelectedIds(new Set(roleData.map((user: any) => user.id)));
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
            Username
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Roles
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Date Created
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Date Updated
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {roleData.map((user: any) => (
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
