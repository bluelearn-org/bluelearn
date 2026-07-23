import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";

import { Route as GuideRoute } from "@/routes/guides/$slug/index";

import { getGuideBySlug } from "@/lib/getData";

import guides from "@/data/guides.json";

export const Route = createFileRoute("/guides/$slug/walkthrough")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  const guide = getGuideBySlug(guides, slug);

  if (!guide) {
    throw notFound();
  }

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] overflow-y-auto border-x bg-background">
      <section className="px-10 py-4 lg:px-16">
        {/* MAIN */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Walkthrough
          </h1>
          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={GuideRoute.to}
              params={{ slug: slug }}
              // state={{
              //   breadcrumbOrigin: {
              //     type: "objective",
              //     title: objective.title,
              //     path: `/objectives/${slug}`,
              //   },
              // }}
              className="btn-outline"
            >
              View Guide
            </Link>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Graph */}
      </section>
    </div>
  );
}
