import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type {
  ContributionType,
  GuideContribution,
  ObjectiveContribution,
} from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import guidesData from "@/data/guides.json";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;
  guideContData: GuideContribution;
  objectiveContData: ObjectiveContribution;
};

export const Submit = ({ Stepper, type, objectiveContData }: PropTypes) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helpers to resolve slugs
  const getGuideTitle = (slug: string) => {
    const guide = guidesData.find((g) => g.slug === slug);
    return guide ? guide.title : slug;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    toast.success("Contribution submitted for review");
    navigate({ to: "/" });
  };

  return (
    <Stepper.Content step="submit">
      <StepperActionHeader title={"Submit"} Stepper={Stepper} hideNext />

      {type === "objective" && (
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
      )}

      {/* Placeholders for guide/variant types */}
      {type === "guide" && (
        <div className="mt-8 text-center text-muted-foreground">
          Guide submission preview goes here.
        </div>
      )}
      {type === "variant" && (
        <div className="mt-8 text-center text-muted-foreground">
          Variant submission preview goes here.
        </div>
      )}

      <div className="mt-8">
        <Button
          className="h-12 w-full text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Contribution"}
        </Button>
      </div>
    </Stepper.Content>
  );
};
