import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type {
  ActivityStatusFilter,
  ActivityTypeFilter,
  ProfilePageData,
} from "@/lib/profile";
import {
  ACTIVITY_STATUS_FILTERS,
  ACTIVITY_TYPE_FILTERS,
  activityStatusLabel,
  activityTypeLabel,
  filterActivity,
  loadProfilePage,
} from "@/lib/profile";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/components/Pagination";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ProfileSearch = {
  q?: string;
  type?: ActivityTypeFilter;
  status?: ActivityStatusFilter;
  sort?: "oldest";
  page?: number;
};

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const page = Number(search.page);
    return {
      q: typeof search.q === "string" && search.q ? search.q : undefined,
      type: ACTIVITY_TYPE_FILTERS.some((f) => f.value === search.type)
        ? (search.type as ActivityTypeFilter)
        : undefined,
      status: ACTIVITY_STATUS_FILTERS.some((f) => f.value === search.status)
        ? (search.status as ActivityStatusFilter)
        : undefined,
      sort: search.sort === "oldest" ? "oldest" : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  },
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

// Need a non-empty value to express "no filter" because Radix
// already reserves the empty string "".
const ALL = "all";

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
  const search = Route.useSearch();
  const setFilters = (next: Partial<ProfileSearch>) =>
    navigate({
      to: "/profile",
      search: (prev) => ({ ...prev, ...next, page: undefined }),
      replace: true,
    });

  const filtered = filterActivity(activity, search);
  const hasFilters = Boolean(search.q || search.type || search.status);

  const {
    page,
    totalPages,
    pageRows,
    start,
    goToPage,
    toFirst,
    onPrevious,
    onNext,
    toLast,
  } = usePagination(filtered, PAGE_SIZE, {
    page: search.page ?? 1,
    onPageChange: (next) =>
      navigate({
        to: "/profile",
        search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
        replace: true,
      }),
  });

  // Hide review stat for non-verifiers.
  const isVerifier = roles.includes("verifier");
  const statsRows = [
    { label: "Upvotes", value: stats.upvotes },
    { label: "Downvotes", value: stats.downvotes },
    { label: "Contributions", value: stats.contributions },
    ...(isVerifier ? [{ label: "Reviews", value: stats.reviews }] : []),
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

          <ul
            className={cn(
              "grid items-start gap-x-6",
              isVerifier ? "grid-cols-4" : "grid-cols-3"
            )}
          >
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

        <div className="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-3 px-4">
          <Input
            value={search.q ?? ""}
            onChange={(e) => setFilters({ q: e.target.value || undefined })}
            placeholder="Search titles..."
            className="h-8 w-full max-w-64"
          />

          <Select
            value={search.type ?? ALL}
            onValueChange={(value) =>
              setFilters({
                type: value === ALL ? undefined : (value as ActivityTypeFilter),
              })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {ACTIVITY_TYPE_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.status ?? ALL}
            onValueChange={(value) =>
              setFilters({
                status:
                  value === ALL ? undefined : (value as ActivityStatusFilter),
              })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {ACTIVITY_STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-brand-blue hover:text-[#3166b1]"
              onClick={() =>
                setFilters({ q: undefined, type: undefined, status: undefined })
              }
            >
              Clear filters
            </Button>
          )}
        </div>

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
                    {heading === "Date" ? (
                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-1 uppercase"
                        onClick={() =>
                          setFilters({
                            sort:
                              search.sort === "oldest" ? undefined : "oldest",
                          })
                        }
                      >
                        {heading}
                        {search.sort === "oldest" ? (
                          <ArrowUpIcon className="size-3.5" />
                        ) : (
                          <ArrowDownIcon className="size-3.5" />
                        )}
                      </button>
                    ) : (
                      heading
                    )}
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
                    {hasFilters
                      ? "No activity matches these filters."
                      : "No activity available yet."}
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
              toFirst={toFirst}
              onPrevious={onPrevious}
              onNext={onNext}
              toLast={toLast}
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
