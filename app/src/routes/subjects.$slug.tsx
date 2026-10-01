import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ObjectiveCard } from "@/components/cards/ObjectiveCard";
import { GuideCard } from "@/components/cards/GuideCard";

import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";
import { Route as GuideRoute } from "@/routes/guides/$slug/index";

import {
  getSubjectBySlug,
  listSubjectGuides,
  listSubjectObjectives,
} from "@/lib/api/subjects";
import { formatDuration } from "@/lib/guideUtils";
import { buildPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/subjects/$slug")({
  loader: async ({ params, abortController }) => {
    const { slug } = params;
    const signal = abortController.signal;
    const [subject, objectives, guides] = await Promise.all([
      getSubjectBySlug(slug, { signal }),
      listSubjectObjectives(slug, { signal }),
      listSubjectGuides(slug, { signal }),
    ]);
    return { subject, objectives, guides };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? buildPageMeta(
          loaderData.subject.name,
          `Explore free guides and learning objectives about ${loaderData.subject.name} on Bluelearn.`
        )
      : [],
  }),
  errorComponent: SubjectError,
  component: SubjectPage,
});

function formatDate(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SubjectError() {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <p className="text-sm text-muted-foreground">
          This subject could not be loaded. Try again shortly.
        </p>
      </section>
    </div>
  );
}

function SubjectPage() {
  const { slug } = Route.useParams();
  const { subject, objectives, guides } = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {subject.name} Learning Objectives ({objectives.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {objectives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No objectives tagged with this subject yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {objectives.map((objective) => {
              const o = {
                slug: objective.slug ?? "",
                title: objective.title,
                summary: objective.summary,
                curator: objective.curator,
                created_at: formatDate(objective.created_at),
                featuredSubObjective: objective.featured_sub_objective,
                stats: [
                  {
                    label: "Duration",
                    data: formatDuration(objective.duration_minutes),
                  },
                  { label: "Guides", data: objective.guides_total },
                ],
              };
              return (
                <ObjectiveCard
                  key={objective.id}
                  objective={o}
                  to={ObjectiveRoute.to}
                  origin={{
                    type: "subject",
                    title: subject.name,
                    path: `/subjects/${slug}`,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="border-b px-8 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="data-label text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            {subject.name} Guides ({guides.length})
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        {guides.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No guides tagged with this subject yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {guides.map((guide) => {
              const g = {
                slug: guide.slug ?? "",
                title: guide.title ?? "",
                author: guide.author,
                summary: guide.summary,
                created_at: formatDate(guide.created_at),
                tags: guide.tags,
                stats: [
                  {
                    label: "Duration",
                    data: formatDuration(guide.duration_minutes),
                  },
                ],
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
                          params: { slug: guide.slug ?? "" },
                          state: {
                            breadcrumbOrigin: {
                              type: "subject",
                              title: subject.name,
                              path: `/subjects/${slug}`,
                            },
                          },
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
              };
              return (
                <GuideCard
                  key={guide.id}
                  guide={g}
                  to={GuideRoute.to}
                  origin={{
                    type: "subject",
                    title: subject.name,
                    path: `/subjects/${slug}`,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
