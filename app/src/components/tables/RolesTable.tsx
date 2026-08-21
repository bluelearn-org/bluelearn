import { useState } from "react";
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

export const RolesTable = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const roleData = [
    {
      id: "001",
      username: "andrea",
      roles: ["admin", "curator"],
      date_created: "08-14-2026",
      date_updated: "08-21-2026",
      is_afk: false,
    },
    {
      id: "002",
      username: "bob",
      roles: ["verifier"],
      date_created: "08-14-2026",
      date_updated: "08-21-2026",
      is_afk: true,
    },
  ];

  const allSelected =
    roleData.length > 0 &&
    roleData.every((profile) => selectedIds.has(profile.id));

  function toggleUser(userId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }

      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        const next = new Set(current);
        roleData.forEach((user) => next.delete(user.id));
        return next;
      }

      return new Set(roleData.map((user) => user.id));
    });
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
            AFK
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {roleData.map((user) => (
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

            <TableCell className="flex max-w-sm gap-2 px-4 py-3">
              {user.roles.map((role) => (
                <Badge
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {role}
                </Badge>
              ))}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {user.date_created}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {user.date_updated}
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {user.is_afk ? "true" : "false"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
