import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { GuideListItem, ObjectiveListItem } from "@bluelearn/schemas";
import type {
  Collection,
  KnowledgeType,
  SearchFilters,
} from "@/lib/api/search";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";
import { Route as GuideRoute } from "@/routes/guides/$slug/index";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { GuideCard } from "@/components/cards/GuideCard";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { SearchFilterMenu } from "@/components/SearchFilterMenu";
import { ApiError } from "@/lib/api/apiHelpers";
import { filtersToParams, search } from "@/lib/api/search";
import { listGuidesPage } from "@/lib/api/guides";
import { listObjectives } from "@/lib/api/objectives";
import { formatDate, formatDuration } from "@/lib/guideUtils";
import { buildPageMeta } from "@/lib/seo";

const PAGE_SIZE = 10;

type BrowseSearch = {
  q?: string;
  scope?: Collection;
  kind?: KnowledgeType;
  guidesPage?: number;
  objectivesPage?: number;
};

type Section<T> = { found: number; items: Array<T> };

function pageParam(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : undefined;
}

async function fetchGuides(
  { q, kind, page }: { q?: string; kind?: KnowledgeType; page: number },
  signal: AbortSignal
): Promise<Section<GuideListItem>> {
  if (!q) {
    const { guides, total } = await listGuidesPage(
      { page, limit: PAGE_SIZE },
      { signal }
    );
    return { found: total, items: guides };
  }

  try {
    const { guides } = await search(
      {
        q,
        page,
        per_page: PAGE_SIZE,
        ...filtersToParams({ scope: "guides", knowledgeType: kind }),
      },
      { signal }
    );
    return guides;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404)
      return { found: 0, items: [] };
    throw e;
  }
}

async function fetchObjectives(
  { q, page }: { q?: string; page: number },
  signal: AbortSignal
): Promise<Section<ObjectiveListItem>> {
  if (!q) {
    const { objectives, total } = await listObjectives(
      { page, limit: PAGE_SIZE },
      { signal }
    );
    return { found: total, items: objectives };
  }

  try {
    const { objectives } = await search(
      {
        q,
        page,
        per_page: PAGE_SIZE,
        ...filtersToParams({ scope: "objectives" }),
      },
      { signal }
    );
    return objectives;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404)
      return { found: 0, items: [] };
    throw e;
  }
}

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: buildPageMeta(
      "Browse",
      "Find free guides and learning objectives on Bluelearn. Search by topic and explore what to learn next."
    ),
  }),
  validateSearch: (raw): BrowseSearch => {
    const q = typeof raw.q === "string" ? raw.q.trim() : "";
    const scope =
      raw.scope === "guides" || raw.scope === "objectives"
        ? raw.scope
        : undefined;
    const kind =
      raw.kind === "theoretical" || raw.kind === "practical"
        ? raw.kind
        : undefined;
    const guidesPage = pageParam(raw.guidesPage);
    const objectivesPage = pageParam(raw.objectivesPage);
    return {
      ...(q ? { q } : {}),
      ...(scope ? { scope } : {}),
      ...(q && scope === "guides" && kind ? { kind } : {}),
      ...(scope !== "objectives" && guidesPage ? { guidesPage } : {}),
      ...(scope !== "guides" && objectivesPage ? { objectivesPage } : {}),
    };
  },
  loaderDeps: ({ search: { q, scope, kind, guidesPage, objectivesPage } }) => ({
    q,
    scope,
    kind,
    guidesPage,
    objectivesPage,
  }),
  loader: async ({
    deps: { q, scope, kind, guidesPage = 1, objectivesPage = 1 },
    abortController: { signal },
  }) => {
    try {
      const [guides, objectives] = await Promise.all([
        scope !== "objectives"
          ? fetchGuides({ q, kind, page: guidesPage }, signal)
          : null,
        scope !== "guides"
          ? fetchObjectives({ q, page: objectivesPage }, signal)
          : null,
      ]);
      return { guides, objectives, error: null };
    } catch (e) {
      if (signal.aborted) throw e;
      return {
        guides: null,
        objectives: null,
        error: e instanceof Error ? e.message : "Something went wrong",
      };
    }
  },
  component: RouteComponent,
});

function objectiveCards(items: Array<ObjectiveListItem>) {
  return items
    .filter((o): o is typeof o & { slug: string } => o.slug !== null)
    .map((o) => ({
      slug: o.slug,
      title: o.title,
      summary: o.summary,
      curator: o.curator,
      created_at: formatDate(new Date(o.created_at)),
      featuredSubObjective: o.featured_sub_objective,
      stats: [
        { label: "Duration", data: formatDuration(o.duration_minutes) },
        { label: "Guides", data: o.guides_total },
      ] as Array<{ label: string; data: string | number }>,
    }));
}

function guideCards(items: Array<GuideListItem>) {
  return items
    .filter((g): g is typeof g & { slug: string } => g.slug !== null)
    .map((g) => ({
      slug: g.slug,
      title: g.title ?? "",
      author: g.author,
      summary: g.summary,
      created_at: formatDate(new Date(g.created_at)),
      tags: g.tags,
      stats: [{ label: "Duration", data: formatDuration(g.duration_minutes) }],
    }));
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1280px] bg-background">{children}</div>;
}

function SectionPager({
  found,
  page,
  onSelect,
}: {
  found: number;
  page: number;
  onSelect: (page: number) => void;
}) {
  const totalPages = Math.ceil(found / PAGE_SIZE);
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 mb-4">
      <Pagination
        activePageNo={page}
        onPageSelect={onSelect}
        toFirst={() => onSelect(1)}
        onPrevious={() => onSelect(Math.max(1, page - 1))}
        onNext={() => onSelect(Math.min(totalPages, page + 1))}
        toLast={() => onSelect(totalPages)}
        totalPages={totalPages}
      />
    </div>
  );
}

function RouteComponent() {
  const {
    q,
    scope,
    kind,
    guidesPage = 1,
    objectivesPage = 1,
  } = Route.useSearch();
  const { guides, objectives, error } = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  // Local field state, kept in sync with the URL so back/forward updates it.
  const [query, setQuery] = useState(q ?? "");
  useEffect(() => setQuery(q ?? ""), [q]);

  const sectionHeadingCommonClassNames =
    "font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground ml-1";

  // Merge into existing params so q and the filters don't clobber each other.
  // validateSearch drops empty values, keeping the URL clean.
  const submit = (next: string) =>
    navigate({
      search: (prev) => ({
        ...prev,
        q: next.trim(),
        guidesPage: undefined,
        objectivesPage: undefined,
      }),
    });
  const setFilters = (f: SearchFilters) =>
    navigate({
      search: (prev) => ({
        ...prev,
        scope: f.scope,
        kind: f.knowledgeType,
        guidesPage: undefined,
        objectivesPage: undefined,
      }),
    });

  return (
    <Shell>
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Browse
          </h1>
        </div>

        <Separator className="mb-8 bg-border" />

        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={() => submit(query)}
          onClear={() => {
            setQuery("");
            submit("");
          }}
          filter={
            <SearchFilterMenu
              value={{ scope, knowledgeType: kind }}
              onChange={setFilters}
            />
          }
        />
      </section>

      {error && (
        <p className="px-8 py-10 text-sm text-destructive lg:px-16">{error}</p>
      )}

      {!error && (
        <section className="px-8 py-10 lg:px-16">
          {/* Objectives */}
          {objectives && (
            <CollapsibleSection
              title={
                <h2 className={sectionHeadingCommonClassNames}>
                  Learning Objectives ({objectives.found})
                </h2>
              }
              defaultOpen={true}
            >
              <Separator className="mb-8 h-[0.5px]! bg-border" />
              {objectives.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {q ? "No objectives found." : "No objectives yet."}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {objectiveCards(objectives.items).map((objective) => (
                    <ObjectiveCard
                      key={objective.slug}
                      objective={objective}
                      to={ObjectiveRoute.to}
                    />
                  ))}
                </div>
              )}

              <SectionPager
                found={objectives.found}
                page={objectivesPage}
                onSelect={(p) =>
                  navigate({
                    search: (prev) => ({ ...prev, objectivesPage: p }),
                  })
                }
              />
            </CollapsibleSection>
          )}

          {/* Guides */}
          {guides && (
            <CollapsibleSection
              title={
                <h2 className={sectionHeadingCommonClassNames}>
                  Guides ({guides.found})
                </h2>
              }
              defaultOpen={true}
            >
              <Separator className="mb-8 bg-border" />
              {guides.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {q ? "No guides found." : "No guides yet."}
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {guideCards(guides.items).map((guide) => (
                    <GuideCard
                      key={guide.slug}
                      guide={{
                        ...guide,
                        actionBtns: (
                          <div className="col-span-2 col-start-3 mt-5 flex items-center justify-around border-t-1 p-4 pt-8 lg:mt-0 lg:border-none lg:pt-4">
                            <Button
                              variant="outline"
                              className="btn-sec"
                              size="lg"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate({
                                  to: "/guides/$slug/walkthrough",
                                  params: { slug: guide.slug },
                                });
                              }}
                            >
                              View Walkthrough
                            </Button>

                            <Button className="btn-pri" size="lg">
                              Read
                            </Button>
                          </div>
                        ),
                      }}
                      to={GuideRoute.to}
                    />
                  ))}
                </div>
              )}

              <SectionPager
                found={guides.found}
                page={guidesPage}
                onSelect={(p) =>
                  navigate({ search: (prev) => ({ ...prev, guidesPage: p }) })
                }
              />
            </CollapsibleSection>
          )}
        </section>
      )}
    </Shell>
  );
}
