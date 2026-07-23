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

      <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-6">
        <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {objectiveContData.title || "Untitled Objective"}
                </CardTitle>
                <CardDescription className="text-base">
                  {objectiveContData.summary || "No summary provided."}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Badge
                variant="secondary"
                className="px-3 py-1 font-mono text-xs"
              >
                {objectiveContData.targets.length} Targets
              </Badge>
              {objectiveContData.subjects.map((slug) => (
                <Badge
                  key={slug}
                  variant="secondary"
                  className="border border-muted-foreground/20 bg-muted/60 px-3 py-1 font-mono text-xs text-muted-foreground"
                >
                  {getSubjectName(slug)}
                </Badge>
              ))}
              {objectiveContData.featured && (
                <Badge
                  variant="outline"
                  className="border-foreground/30 px-3 py-1"
                >
                  Featured: {getGuideTitle(objectiveContData.featured)}
                </Badge>
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
            objectiveContData.targets.map((targetSlug, idx) => {
              const sub = objectiveContData.subObjectives.find(
                (s) => s.targetSlug === targetSlug
              );

              return (
                <Card key={idx} className="border-border/40 shadow-sm">
                  <CardHeader className="border-b border-border/40 bg-muted/20 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {idx + 1}. Target:
                      </span>
                      {getGuideTitle(targetSlug)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {sub?.curatedSequence && sub.curatedSequence.length > 0 ? (
                      <ol className="relative ml-3 space-y-6 border-l border-muted-foreground/20">
                        {sub.curatedSequence.map((stepSlug, stepIdx) => (
                          <li
                            key={stepIdx}
                            className="ml-6 flex flex-col gap-1"
                          >
                            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-background font-mono text-xs text-muted-foreground ring-4 ring-background">
                              {stepIdx + 1}
                            </span>
                            <span className="mt-1 text-sm leading-none font-medium">
                              {getGuideTitle(stepSlug)}
                            </span>
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
              );
            })
          )}
        </div>
      </div>
    </Stepper.Content>
  );
};
