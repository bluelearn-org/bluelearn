import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ProfilePageData } from "@/lib/profile";
import {
  activityStatusLabel,
  activityTypeLabel,
  loadProfilePage,
} from "@/lib/profile";
import { formatDate } from "@/lib/guideUtils";
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile")({
  loader: ({ abortController }) => loadProfilePage(abortController.signal),
  component: RouteComponent,
  pendingComponent: () => <ProfileMessage>Loading profile...</ProfileMessage>,
  errorComponent: ({ error }) => (
    <ProfileMessage tone="error">{error.message}</ProfileMessage>
  ),
});

function ProfileMessage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div className="mx-auto max-w-7xl border-x bg-background px-8 py-10 lg:px-16">
      <p
        className={
          tone === "error"
            ? "text-sm text-red-600"
            : "text-sm text-muted-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}

// first two letters for the user's initials
function getInitials(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "?";
  const parts = text.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type ActivityRow = ProfilePageData["activity"][number];

// An approved guide, a published objective, or a reviewed guide can be opened;
// anything still in flight has no live page to land on.
function rowTarget(row: ActivityRow) {
  if (row.content_kind === "review")
    return row.target_slug
      ? { to: "/guides/$slug", slug: row.target_slug }
      : null;
  if (
    row.content_kind === "guide" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/guides/$slug", slug: row.target_slug };
  if (
    row.content_kind === "objective" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/objectives/$slug", slug: row.target_slug };
  return null;
}

function ProfilePage({ profile, roles, stats, activity }: ProfilePageData) {
  const navigate = useNavigate();
  const roleLabel = roles.length > 0 ? roles.join(", ") : "Member";

  const statsRows = [
    { label: "Upvote", value: stats.upvotes },
    { label: "Downvote", value: stats.downvotes },
    { label: "Contributions", value: stats.contributions },
    { label: "Reviews", value: stats.reviews },
  ];

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
                {[
                  "Type",
                  "Title",
                  "Change Summary",
                  "Date",
                  "Status",
                  "Review Case",
                ].map((heading) => (
                  <TableHead
                    key={heading}
                    className="px-4 py-3 font-mono text-[14px] tracking-[0.08em] uppercase"
                  >
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No activity available yet.
                  </TableCell>
                </TableRow>
              ) : (
                activity.map((row, index) => {
                  const target = rowTarget(row);
                  return (
                    <TableRow
                      key={`${row.content_kind}-${index}`}
                      className={target ? "cursor-pointer" : undefined}
                      onClick={
                        target
                          ? () =>
                              navigate({
                                to: target.to,
                                params: { slug: target.slug },
                              })
                          : undefined
                      }
                    >
                      <TableCell className="px-4 py-3">
                        {activityTypeLabel(row)}
                      </TableCell>

                      <TableCell className="px-4 py-3">{row.title}</TableCell>

                      <TableCell className="px-4 py-3">
                        {row.change_summary}
                      </TableCell>

                      <TableCell className="mono-micro px-4 py-3">
                        {formatDate(new Date(row.created_at))}
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                        >
                          {activityStatusLabel(row.status)}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        {row.review_case_id ? (
                          <Button
                            className="btn-pri"
                            size="lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/review/$slug",
                                params: { slug: row.review_case_id! },
                              });
                            }}
                          >
                            View case
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function RouteComponent() {
  const data = Route.useLoaderData();
  return <ProfilePage {...data} />;
}
