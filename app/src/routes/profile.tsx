import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type {
  ProfileAPI,
  ProfileActivityRow,
  ProfileRole,
  ProfileStats,
} from "@/lib/profile";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { fetchMyProfile } from "@/lib/profile";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile")({
  component: RouteComponent,
});

const DEFAULT_STATS: ProfileStats = {
  upvotes: undefined,
  downvotes: undefined,
  contributions: undefined,
  reviews: undefined,
};
// fucntion for getting the first two letters for the user's initials
function getInitials(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "?";
  const parts = text.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface ProfilePageProps {
  profile: ProfileAPI;
  roles: Array<ProfileRole>;
  stats?: ProfileStats;
  activityRows?: Array<ProfileActivityRow>;
}

function ProfilePage({
  profile,
  roles,
  stats = DEFAULT_STATS,
  activityRows = [],
}: ProfilePageProps) {
  const roleLabel = roles.length > 0 ? roles.join(", ") : "Member";

  const statsRows = useMemo(
    () => [
      { label: "Upvote", value: stats.upvotes ?? "—" },
      { label: "Downvote", value: stats.downvotes ?? "—" },
      { label: "Contributions", value: stats.contributions ?? "—" },
      { label: "Reviews", value: stats.reviews ?? "—" },
    ],
    [stats]
  );

  const initials = getInitials(profile.display_name || profile.username);

  return (
    <div className="mx-auto max-w-7xl border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mb-6 flex flex-col items-center justify-center gap-8 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center sm:w-1/4">
            <Avatar className="size-30 bg-gray-500">
              <AvatarImage className="grayscale" />
              <AvatarFallback className="bg-gray-300 text-2xl font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-3 mb-1 text-xl font-bold">
              {profile.display_name ?? profile.username}
            </h2>
            <h3 className="text-sm text-gray-600">{roleLabel}</h3>
          </div>

          <div className="w-full sm:w-1/4">
            <ul className="grid grid-cols-2 grid-rows-2 gap-y-8">
              {statsRows.map((stat) => (
                <li key={stat.label} className="flex flex-col items-center">
                  <h3 className="data-label">{stat.label}</h3>
                  <p className="data-value">{stat.value}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="mb-8 bg-border" />
        <div className="overflow-x-auto">
          <Table className="mx-auto w-full max-w-5xl">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Type
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Title
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Change Summary
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Date
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Status
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase">
                  Review Case
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No activity available yet.
                  </TableCell>
                </TableRow>
              ) : (
                activityRows.map((data, index) => (
                  <TableRow
                    key={`${data.type}-${index}`}
                    className="cursor-pointer"
                    onClick={() => {}} // TODO: opens to draft/published guide/variant/objective
                  >
                    <TableCell className="px-4 py-3">{data.type}</TableCell>

                    <TableCell className="px-4 py-3">{data.title}</TableCell>

                    <TableCell className="px-4 py-3">
                      {data.change_summary}
                    </TableCell>

                    <TableCell className="mono-micro px-4 py-3">
                      {data.date}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                      >
                        {data.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Button
                        className="btn-pri"
                        size="lg"
                        onClick={() => {}} // TODO: opens review page - guide/variant/objective - with review notes
                      >
                        {data.review_case}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function RouteComponent() {
  const [profile, setProfile] = useState<ProfileAPI | null>(null);
  const [roles, setRoles] = useState<Array<ProfileRole>>([]);
  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS);
  const [activityRows, setActivityRows] = useState<Array<ProfileActivityRow>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyProfile()
      .then((result) => {
        setProfile(result.profile);
        setRoles(result.roles);
        setStats(result.stats ?? DEFAULT_STATS);
        setActivityRows(result.activity ?? []);
      })
      .catch((err) => setError(err.message ?? "Unable to load profile."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl border-x bg-background px-8 py-10 lg:px-16">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl border-x bg-background px-8 py-10 lg:px-16">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl border-x bg-background px-8 py-10 lg:px-16">
        <p className="text-sm text-muted-foreground">
          Profile data is unavailable.
        </p>
      </div>
    );
  }

  return (
    <ProfilePage
      profile={profile}
      roles={roles}
      stats={stats}
      activityRows={activityRows}
    />
  );
}
