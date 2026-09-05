import { useState } from "react";
import {
  Link,
  createFileRoute,
  notFound,
  useLocation,
} from "@tanstack/react-router";
import {
  ArrowBigDown,
  ArrowBigUp,
  Ellipsis,
  House,
  Pencil,
  Plus,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { getGuide } from "@/lib/api/guides";

import "katex/dist/katex.min.css";
import { GuideSidebar } from "@/components/sidebar/GuideSidebar";
import { GuideReader } from "@/components/GuideReader";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Route as GuideWalkthroughRoute } from "@/routes/guides/$slug/walkthrough";

import { DownvoteModal } from "@/components/modals/DownvoteModal";

import { useVote } from "@/lib/useVote";
import { GuideSidebarActions } from "@/components/sidebar/GuideSidebarActions";
import { GuideMobileMenu } from "@/components/GuideMobileMenu";

export const Route = createFileRoute("/guides/$slug/")({
  loader: async ({ params, abortController }) => {
    try {
      return await getGuide(params.slug, { signal: abortController.signal });
    } catch {
      throw notFound();
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const guide = Route.useLoaderData();

  const { vote, tally, submitting, upvote, downvote, removeVote } = useVote(
    guide.variant_id
  );
  const [downvoteOpen, setDownvoteOpen] = useState(false);

  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });

  const guideMenuItems = [
    {
      label: "Edit Guide",
      to: `/guides/${slug}/${guide.variant_slug}/edit`,
      icon: <Pencil className="h-4 w-4" />,
    },
    ...(guide.is_official
      ? []
      : [
          {
            label: "Create Variant",
            to: "/contribute",
            icon: <Plus className="h-4 w-4" />,
          },
        ]),
    // { label: "Report", to: "/report", <Flag className="h-4 w-4" /> },// TODO: Implement post v1
  ];

  const breadcrumbs = buildBreadcrumbs(guide.title, breadcrumbOrigin);

  return (
    <div className="mx-auto max-w-7xl bg-background">
      <section className="flex flex-col border-b md:grid md:grid-cols-[320px_1fr]">
        <GuideSidebar
          sidebarActions={
            <GuideSidebarActions
              slug={slug}
              currentVariantSlug={guide.variant_slug}
              variantId={guide.variant_id}
              isOfficial={guide.is_official}
            />
          }
          guide={guide}
          slug={slug}
        />

        {/* MAIN */}
        <main className="min-w-0 px-4 py-4 md:px-10 lg:px-16">
          {/* Breadcrumbs */}
          <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <ul className="flex min-w-0 flex-nowrap items-center gap-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
              {breadcrumbs.map((crumb, idx) => (
                <li
                  key={`${crumb.label}-${idx}`}
                  className="mono-micro flex min-w-0 items-center gap-2"
                >
                  {crumb.path ? (
                    <Link
                      to={crumb.path}
                      className="flex min-w-0 items-center hover:text-foreground"
                      aria-label={crumb.label}
                    >
                      {idx === 0 ? (
                        <House className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="max-w-[30ch] truncate">
                          {crumb.label}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="max-w-[30ch] truncate">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <span className="shrink-0">/</span>
                  )}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={GuideWalkthroughRoute.to}
                params={{ slug: slug }}
                state={{ breadcrumbOrigin }}
                className="btn-outline"
              >
                View Walkthrough
              </Link>

              <Button
                variant="outline"
                size="lg"
                aria-label="Upvote guide"
                aria-pressed={vote?.direction === "up"}
                disabled={!guide.variant_id || submitting}
                onClick={() => upvote()}
              >
                <ArrowBigUp
                  className="h-4 w-4"
                  color={vote?.direction === "up" ? "#3D80DD" : "#000000"}
                  fill={vote?.direction === "up" ? "#3D80DD" : "#FFFFFF"}
                />
                <span className="mono-micro">{tally.up}</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                aria-label="Downvote guide"
                aria-pressed={vote?.direction === "down"}
                disabled={!guide.variant_id || submitting}
                onClick={() => setDownvoteOpen(true)}
              >
                <ArrowBigDown
                  className="h-4 w-4"
                  color={vote?.direction === "down" ? "#3D80DD" : "#000000"}
                  fill={vote?.direction === "down" ? "#3D80DD" : "#FFFFFF"}
                />
                <span className="mono-micro">{tally.down}</span>
              </Button>

              <DownvoteModal
                open={downvoteOpen}
                onOpenChange={setDownvoteOpen}
                submitting={submitting}
                existing={
                  vote?.direction === "down"
                    ? { reason: vote.reason, note: vote.note }
                    : null
                }
                onSubmit={async (reason, note) => {
                  if (await downvote(reason, note)) setDownvoteOpen(false);
                }}
                onRemove={async () => {
                  if (await removeVote()) setDownvoteOpen(false);
                }}
              />

              <GuideMobileMenu
                slug={slug}
                currentVariantSlug={guide.variant_slug}
                variantId={guide.variant_id}
                guideTitle={guide.title}
                menuItems={guideMenuItems}
                prerequisites={guide.prerequisites}
                isOfficial={guide.is_official}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden h-9 w-9 cursor-pointer rounded-md md:inline-flex"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48 font-mono">
                  {guideMenuItems.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="cursor-pointer text-xs">
                        {item.icon}
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator className="mb-8" />

          {guide.disclaimers.length > 0 && (
            <DisclaimerBanner disclaimers={guide.disclaimers} />
          )}

          {/* Header */}

          <GuideReader
            guide={guide}
            guideType={guide.knowledge_type}
            showToc
            isOfficial={guide.is_official}
          />
        </main>
      </section>
    </div>
  );
}
