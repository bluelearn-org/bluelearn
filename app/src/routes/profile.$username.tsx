import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { profileActivitySearchSchema } from "@bluelearn/schemas";
import type { ProfileActivitySearch } from "@bluelearn/schemas";
import { getAvatarUrl, getInitials } from "@/lib/profile";
import { getProfilePage } from "@/lib/api/identity";
import { cn } from "@/lib/utils";
import { ActivityTable } from "@/components/profile/ActivityTable";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile/$username")({
  ssr: false,
  validateSearch: profileActivitySearchSchema,
  loader: ({ params, abortController }) =>
    getProfilePage(params.username, { signal: abortController.signal }),
  component: ProfilePage,
  pendingComponent: () => <ProfileMessage>Loading profile...</ProfileMessage>,
  errorComponent: ({ error }) => (
    // TODO: improve error component - add greyscale mascot with "X" eyes
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
    <div className="mx-auto max-w-7xl bg-background px-8 py-10 lg:px-16">
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

function ProfilePage() {
  const { profile, roles, stats, activity } = Route.useLoaderData();
  const { username } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const setFilters = (next: Partial<ProfileActivitySearch>) =>
    navigate({
      to: "/profile/$username",
      params: { username },
      search: (prev) => ({ ...prev, ...next, page: undefined }),
      replace: true,
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
            <Avatar className="size-28 shrink-0 bg-muted">
              <AvatarImage
                src={getAvatarUrl(profile.username)}
                alt={profile.display_name ?? profile.username}
              />
              <AvatarFallback className="bg-muted text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-col">
              <h2 className="text-2xl font-bold break-words sm:text-3xl">
                {profile.display_name ?? profile.username}
              </h2>
              <h3 className="mono-micro text-muted-foreground">
                @{profile.username}
              </h3>

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

              {profile.bio && (
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <ul
            className={cn(
              "grid w-full items-start gap-x-2 gap-y-4 sm:w-auto sm:gap-x-6",
              isVerifier ? "grid-cols-4" : "grid-cols-3"
            )}
          >
            {statsRows.map((stat) => (
              <li
                key={stat.label}
                className="flex min-w-0 flex-col items-center gap-1 sm:min-w-24"
              >
                <h3 className="data-label text-[10px]! leading-none tracking-tight! whitespace-nowrap sm:text-[11px]! sm:tracking-[0.08em]!">
                  {stat.label}
                </h3>
                <p className="data-value text-xl! leading-none sm:text-2xl!">
                  {stat.value}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="mb-8 bg-border" />

        <ActivityTable
          activity={activity}
          search={search}
          setFilters={setFilters}
          onPageChange={(next) =>
            navigate({
              to: "/profile/$username",
              params: { username },
              search: (prev) => ({
                ...prev,
                page: next === 1 ? undefined : next,
              }),
              replace: true,
            })
          }
        />
      </section>
    </div>
  );
}
