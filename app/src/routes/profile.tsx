import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ProfilePageData } from "@/lib/profile";
import {
  activityStatusLabel,
  activityTypeLabel,
  loadProfilePage,
} from "@/lib/profile";
import { formatDate } from "@/lib/guideUtils";
import { Pagination } from "@/components/Pagination";
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

const PAGE_SIZE = 10;

type ActivityRow = ProfilePageData["activity"][number];
function rowTarget(row: ActivityRow) {
  if (row.content_kind === "review")
    return row.target_slug
      ? { to: "/guides/$slug", params: { slug: row.target_slug } }
      : null;
  if (
    row.content_kind === "guide" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/guides/$slug", params: { slug: row.target_slug } };
  if (row.content_kind === "guide" && row.status === "draft" && row.revision_id)
    return { to: "/contribute", search: { draft: row.revision_id } };
  if (
    row.content_kind === "objective" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/objectives/$slug", params: { slug: row.target_slug } };
  return null;
}

function ProfilePage({ profile, roles, stats, activity }: ProfilePageData) {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = activity.slice(start, start + PAGE_SIZE);
  const goToPage = (pageNo: number) =>
    setPage(Math.min(Math.max(pageNo, 1), totalPages));

  const statsRows = [
    { label: "Upvotes", value: stats.upvotes },
    { label: "Downvotes", value: stats.downvotes },
    { label: "Contributions", value: stats.contributions },
    { label: "Reviews", value: stats.reviews },
  ];

  const initials = getInitials(profile.display_name || profile.username);

  return (
    <div className="mx-auto max-w-7xl border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mx-auto mb-6 flex w-full max-w-5xl flex-col items-center gap-8 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar className="size-28 shrink-0 bg-gray-500">
              <AvatarImage className="grayscale" />
              <AvatarFallback className="bg-gray-300 text-2xl font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <h2 className="text-3xl font-bold">
                {profile.display_name ?? profile.username}
              </h2>
              <h3 className="text-sm text-gray-600">@{profile.username}</h3>

              {roles.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap items-center gap-2">
                  {roles.map((role) => (
                    <li key={role}>
                      <Badge
                        variant="outline"
                        className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                      >
                        {role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <ul className="grid grid-cols-4 items-start gap-x-6">
            {statsRows.map((stat) => (
              <li
                key={stat.label}
                className="flex min-w-24 flex-col items-center gap-1"
              >
                <p className="text-2xl leading-none font-bold">{stat.value}</p>
                <h3 className="text-sm leading-none text-muted-foreground">
                  {stat.label}
                </h3>
              </li>
            ))}
          </ul>
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
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No activity available yet.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, index) => {
                  const target = rowTarget(row);
                  return (
                    <TableRow
                      key={`${row.content_kind}-${start + index}`}
                      className={target ? "cursor-pointer" : undefined}
                      onClick={target ? () => navigate(target) : undefined}
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

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              activePageNo={page}
              onPageSelect={goToPage}
              toFirst={() => goToPage(1)}
              onPrevious={() => goToPage(page - 1)}
              onNext={() => goToPage(page + 1)}
              toLast={() => goToPage(totalPages)}
              totalPages={totalPages}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function RouteComponent() {
  const data = Route.useLoaderData();
  return <ProfilePage {...data} />;
}
