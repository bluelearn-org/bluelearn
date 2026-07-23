import { Clock, GraduationCap } from "lucide-react";
import type { ObjectiveContribution } from "@/types/contributions";
import { Separator } from "@/components/ui/separator";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import guidesData from "@/data/guides.json";
import subjectsData from "@/data/subjects.json";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  onPublish: () => void;
  submitting: boolean;
};

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

  return (
    <Stepper.Content step="preview-objective">
      <StepperActionHeader
        title={"Preview Objective"}
        Stepper={Stepper}
        onPublish={onPublish}
        submitting={submitting}
        publishText="Submit"
      />

      <Separator className="mb-8 bg-border" />

      <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-12">
        <Card className="rounded-md bg-background shadow-none">
          <CardHeader className="space-y-4 p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {objectiveContData.title || "Untitled Objective"}
                </CardTitle>
                <CardDescription className="text-base">
                  {objectiveContData.summary || "No summary provided."}
                </CardDescription>
                {objectiveContData.featured && (
                  <p className="pt-1 text-sm text-muted-foreground">
                    <span className="font-semibold">Featured Guide:</span>{" "}
                    {getGuideTitle(objectiveContData.featured)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge
                variant="secondary"
                className="flex items-center gap-1.5 px-3 py-1 font-mono text-xs"
              >
                <GraduationCap className="h-7 w-7" />
                {objectiveContData.targets.length == 1 ? (
                  <span>1 Target Guide</span>
                ) : (
                  <span>{objectiveContData.targets.length} Target Guides</span>
                )}
              </Badge>
              {totalDuration > 0 && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 px-3 py-1 font-mono text-xs"
                >
                  <Clock className="h-7 w-7" />
                  {totalDuration} mins
                </Badge>
              )}
              {objectiveContData.subjects.length > 0 && (
                <>
                  <span className="mx-1 h-1 w-1 rounded-full bg-muted-foreground/30" />
                  {objectiveContData.subjects.map((slug) => (
                    <Badge
                      key={slug}
                      variant="outline"
                      className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                    >
                      {getSubjectName(slug)}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <h3 className="px-1 text-lg font-semibold tracking-tight">
            Curriculum Paths
          </h3>
          {objectiveContData.targets.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No target sequences configured.
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-badge-border bg-badge font-mono text-xs font-semibold text-badge-foreground">
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
                              {getTargetDuration(targetSlug)} mins
                            </span>
                          )}
                        </div>
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
                                      {getGuideDuration(stepSlug)} mins
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
