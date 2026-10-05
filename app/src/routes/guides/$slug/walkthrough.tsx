import { useEffect, useState } from "react";
import { createFileRoute, useLocation } from "@tanstack/react-router";

import type { Walkthrough } from "@bluelearn/schemas";

import { WalkthroughGraph } from "@/components/graph/WalkthroughGraph";
import { WalkthroughPanel } from "@/components/graph/WalkthroughPanel";
import { getGuideWalkthrough } from "@/lib/api/guides";

export const Route = createFileRoute("/guides/$slug/walkthrough")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  // Carried in from the reader so going back restores the trail the user came by.
  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });

  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Panel never sits empty: no click yet means it describes the target.
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const selectedSlug = selectedGuide ?? slug;

  const [walkthroughData, setWalkthroughData] = useState<Walkthrough | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setWalkthroughData(null);
    setSelectedGuide(null);
    setError(null);
    getGuideWalkthrough(slug, {
      signal: controller.signal,
      followUpDepth: 1,
    })
      .then(setWalkthroughData)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      });

    return () => controller.abort();
  }, [slug]);

  // Escape leaves fullscreen, since the toggle button is the only other way out.
  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const selectedNode = walkthroughData?.nodes.find(
    (node) => node.slug === selectedSlug
  );
  const targetTitle =
    walkthroughData?.nodes.find((node) => node.slug === slug)?.title ?? "";

  return (
    <div className="mx-auto max-w-7xl bg-background md:h-[calc(100vh-65px)]">
      {/* Panel sits under the graph on small screens, beside it from md up. */}
      <section className="flex h-full flex-col-reverse md:grid md:grid-cols-[320px_1fr]">
        {selectedNode ? (
          <WalkthroughPanel
            node={selectedNode}
            targetSlug={slug}
            targetTitle={targetTitle}
            breadcrumbOrigin={breadcrumbOrigin}
          />
        ) : (
          <aside className="hidden h-full border-r px-6 py-6 md:block" />
        )}

        {/* MAIN */}
        <section className="flex h-full min-w-0 flex-col px-4 py-6 md:px-10 lg:px-16">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Walkthrough
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore the recommended learning progression for this guide.
            </p>
          </div>

          {/* Graph */}
          <div
            className={
              isFullscreen
                ? "fixed inset-0 z-50 bg-background"
                : "h-[500px] w-full overflow-hidden rounded-xl border border-border bg-muted/10 md:h-auto md:min-h-[500px] md:flex-1"
            }
          >
            {error ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {error}
              </div>
            ) : walkthroughData ? (
              <WalkthroughGraph
                walkthroughData={walkthroughData}
                targetSlug={slug}
                hoveredGuide={hoveredGuide}
                onHoverGuide={setHoveredGuide}
                selectedGuide={selectedSlug}
                onSelectGuide={setSelectedGuide}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Loading walkthrough...
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
