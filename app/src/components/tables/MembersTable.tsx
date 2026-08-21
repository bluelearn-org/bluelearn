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

export const MembersTable = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const profiles = [
    {
      id: "001",
      username: "andrea",
      display_name: "Andrea",
      bio: "Software Engineer",
      date_created: "08-14-2026",
      date_updated: "08-21-2026",
      is_afk: false,
      is_suspended: false,
    },
    {
      id: "002",
      username: "bob",
      display_name: "Bob",
      bio: "Writer",
      date_created: "08-14-2026",
      date_updated: "08-21-2026",
      is_afk: true,
      is_suspended: false,
    },
  ];

  const allSelected =
    profiles.length > 0 &&
    profiles.every((profile) => selectedIds.has(profile.id));

  function toggleProfile(profileId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }

      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        const next = new Set(current);
        profiles.forEach((profile) => next.delete(profile.id));
        return next;
      }

      return new Set(profiles.map((profile) => profile.id));
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
            Display Name
          </TableHead>

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Bio
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

          <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
            Suspended
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {profiles.map((profile) => (
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
              {profile.display_name}
            </TableCell>

            <TableCell className="max-w-sm px-4 py-3 break-words whitespace-pre-line">
              {profile.bio || "—"}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {profile.date_created}
            </TableCell>

            <TableCell className="mono-micro px-4 py-3 whitespace-nowrap">
              {profile.date_updated}
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {profile.is_afk ? "true" : "false"}
              </Badge>
            </TableCell>

            <TableCell className="px-4 py-3">
              <Badge
                variant="outline"
                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {profile.is_suspended ? "true" : "false"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
