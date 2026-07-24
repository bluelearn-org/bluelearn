import React from "react";
import { ArrowRight } from "lucide-react";
import type { ObjectiveContribution } from "@/types/contributions";
import { Separator } from "@/components/ui/separator";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import guidesData from "@/data/guides.json";
import subjectsData from "@/data/subjects.json";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  onPublish: () => void;
  submitting: boolean;
};

type FeaturedNode = {
  position: number;
  slug: string | null;
  title: string | null;
};

function FeaturedSubObjective({ nodes }: { nodes: Array<FeaturedNode> }) {
  const shown = nodes.slice(-3);
  const hidden = nodes.length - shown.length;

  return (
    <CardContent className="border-t p-4">
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12">
        {hidden > 0 && (
          <React.Fragment>
            <div className="flex w-full flex-col items-center justify-center text-center sm:w-18 md:w-22">
              <span className="flex h-8 shrink-0 items-center justify-center text-sm font-medium">
                {hidden}
              </span>
              <span className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                guides
              </span>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" />
            </div>
          </React.Fragment>
        )}
        {shown.map((step, index) => (
          <React.Fragment key={step.position}>
            <div className="flex w-full flex-col items-center justify-center text-center sm:w-24 md:w-28">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge text-sm font-medium">
                {step.position}
              </span>
              <span className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                {step.title}
              </span>
            </div>
            {index < shown.length - 1 && (
              <div className="flex items-center justify-center">
                <ArrowRight className="h-5 w-5 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </CardContent>
  );
}

function PreviewObjectiveCard({ objective }: { objective: any }) {
  return (
    <Card className="group flex flex-col justify-between rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      <CardHeader className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Objective
          </p>
        </div>

        <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
          {objective.title}
        </h3>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {objective.summary}
        </p>

        <div className="flex items-center justify-between">
          <p className="mono-micro text-muted-foreground">
            @{objective.curator} | {objective.created_at}
          </p>
        </div>

        {objective.tags && objective.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4">
            {objective.tags.map((tag: any) => {
              const slug = typeof tag === "string" ? tag : tag.slug;
              const name = typeof tag === "string" ? tag : tag.name;
              return (
                <Badge
                  key={slug}
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {name}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>

      {objective.featuredSubObjective &&
        objective.featuredSubObjective.length > 0 && (
          <FeaturedSubObjective nodes={objective.featuredSubObjective} />
        )}

      {(objective.stats || objective.actionBtns) && (
        <Footer
          data={{ stats: objective.stats, actionBtns: objective.actionBtns }}
        />
      )}
    </Card>
  );
}

export const PreviewObjective = ({
  Stepper,
  objectiveContData,
  onPublish,
  submitting,
}: PropTypes) => {
  // Helpers to resolve slugs
  const getGuideTitle = (slug: string) => {
    const guide = guidesData.find((g) => g.slug === slug);
    return guide ? guide.title : slug;
  };

  const getSubjectName = (slug: string) => {
    const subject = subjectsData.find((s) => s.slug === slug);
    return subject ? subject.name : slug;
  };

  const getGuideDuration = (slug: string) => {
    const guide = guidesData.find((g) => g.slug === slug);
    return guide?.duration || 0;
  };

  const getGuideSummary = (slug: string) => {
    const guide = guidesData.find((g) => g.slug === slug);
    return guide?.summary || null;
  };

  const getGuideTags = (slug: string) => {
    const guide = guidesData.find((g) => g.slug === slug);
    return guide?.tags || [];
  };

  const getTargetDuration = (targetSlug: string) => {
    const sub = objectiveContData.subObjectives.find(
      (s) => s.targetSlug === targetSlug
    );
    if (sub?.curatedSequence && sub.curatedSequence.length > 0) {
      return sub.curatedSequence.reduce(
        (acc, slug) => acc + getGuideDuration(slug),
        0
      );
    }
    return getGuideDuration(targetSlug);
  };

  const totalDuration = objectiveContData.targets.reduce(
    (acc, targetSlug) => acc + getTargetDuration(targetSlug),
    0
  );

  const totalGuides = objectiveContData.targets.reduce((acc, targetSlug) => {
    const sub = objectiveContData.subObjectives.find(
      (s) => s.targetSlug === targetSlug
    );
    if (sub?.curatedSequence && sub.curatedSequence.length > 0) {
      return acc + sub.curatedSequence.length;
    }
    return acc + 1;
  }, 0);

  const featuredTargetSlug =
    objectiveContData.featured || objectiveContData.targets[0];
  const featuredSub = featuredTargetSlug
    ? objectiveContData.subObjectives.find(
        (s) => s.targetSlug === featuredTargetSlug
      )
    : null;

  let featuredSubObjectiveNodes = undefined;
  if (featuredTargetSlug) {
    const sequence =
      featuredSub?.curatedSequence && featuredSub.curatedSequence.length > 0
        ? featuredSub.curatedSequence
        : [featuredTargetSlug];
    featuredSubObjectiveNodes = sequence.map((slug, idx) => ({
      position: idx + 1,
      slug,
      title: getGuideTitle(slug),
    }));
  }

  const previewData = {
    slug: "",
    title: objectiveContData.title || "Untitled Objective",
    summary: objectiveContData.summary || "No summary provided.",
    curator: "preview",
    created_at: "Today",
    featuredSubObjective: featuredSubObjectiveNodes,
    stats: [
      {
        label: "Duration",
        data: `${totalDuration} min`,
      },
      {
        label: "Sub-objectives",
        data: objectiveContData.targets.length,
      },
      {
        label: "Guides",
        data: totalGuides,
      },
    ],
    tags: objectiveContData.subjects.map((slug) => ({
      slug,
      name: getSubjectName(slug),
    })),
  };

  return (
    <Stepper.Content step="preview-objective">
      <StepperActionHeader
        title={"Preview Objective"}
        Stepper={Stepper}
        onPublish={onPublish}
        submitting={submitting}
      />

      <Separator className="mb-8 bg-border" />

      <div className="mt-8 flex w-full flex-col gap-12">
        <PreviewObjectiveCard objective={previewData} />

        <div className="space-y-6">
          <h3 className="px-1 text-lg font-semibold tracking-tight">
            Sub-Objectives
          </h3>
          {objectiveContData.targets.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No subobjectives configured.
            </p>
          ) : (
            <ol className="m-0 flex w-full list-none flex-col gap-10 p-0">
              {objectiveContData.targets.map((targetSlug, idx) => {
                const sub = objectiveContData.subObjectives.find(
                  (s) => s.targetSlug === targetSlug
                );

                return (
                  <li
                    key={idx}
                    className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-badge-border bg-badge font-mono text-base font-semibold text-badge-foreground sm:m-8 md:m-16 lg:m-28">
                      {idx + 1}
                    </div>

                    <Card className="flex-1 rounded-md bg-background shadow-none transition-colors hover:bg-muted">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base font-medium">
                            {getGuideTitle(targetSlug)}
                          </CardTitle>
                          {getTargetDuration(targetSlug) > 0 && (
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                              {getTargetDuration(targetSlug)} min
                            </span>
                          )}
                        </div>
                        {getGuideSummary(targetSlug) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {getGuideSummary(targetSlug)}
                          </p>
                        )}
                        {getGuideTags(targetSlug).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {getGuideTags(targetSlug).map((tagSlug) => (
                              <Badge
                                key={tagSlug}
                                variant="outline"
                                className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                              >
                                {getSubjectName(tagSlug)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="border-t p-4">
                        {sub?.curatedSequence &&
                        sub.curatedSequence.length > 0 ? (
                          <ol className="relative ml-3 space-y-6 border-l border-muted-foreground/20">
                            {sub.curatedSequence.map((stepSlug, stepIdx) => (
                              <li
                                key={stepIdx}
                                className="ml-6 flex flex-col gap-1"
                              >
                                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-background font-mono text-xs text-muted-foreground ring-4 ring-background">
                                  {stepIdx + 1}
                                </span>
                                <div className="mt-1 flex items-center justify-between gap-4">
                                  <span className="text-sm leading-none font-medium">
                                    {getGuideTitle(stepSlug)}
                                  </span>
                                  {getGuideDuration(stepSlug) > 0 && (
                                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                                      {getGuideDuration(stepSlug)} min
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Default sequence will be used.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Stepper.Content>
  );
};
