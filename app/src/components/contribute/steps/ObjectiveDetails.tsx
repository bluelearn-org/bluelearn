import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

import guidesData from "@/data/blueguides.json";

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
};

export const ObjectiveDetails = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
}: PropTypes) => {
  const guides = guidesData.map((g) => {
    return {
      value: g.slug,
      label: g.title,
      description: g.summary,
    };
  });

  const targs = useMemo(
    () =>
      guides.filter((item) => objectiveContData.targets.includes(item.value)),
    [guides, objectiveContData.targets]
  );

  const isNextDisabled = useMemo(() => {
    return objectiveContData.targets.length === 0;
  }, [objectiveContData.targets]);

  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader
        title={"Objective Details"}
        Stepper={Stepper}
        nextDisabled={isNextDisabled}
      />

      <FieldGroup>
        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Title
          </FieldLabel>

          <Input
            id="title"
            type="text"
            autoComplete="Title"
            maxLength={50}
            placeholder="Choose a title. (Maximum 50 characters)."
            className="h-10 rounded-md"
            required
            value={objectiveContData.title}
            onChange={(e) =>
              setObjectiveContData((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Summary
          </FieldLabel>

          <textarea
            className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            rows={4}
            placeholder="Write a summary for the objective."
            required
            value={objectiveContData.summary}
            onChange={(e) =>
              setObjectiveContData((prev) => ({
                ...prev,
                summary: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Target Guides
          </FieldLabel>

          <Combobox
            multiple
            items={guides}
            value={objectiveContData.targets}
            onValueChange={(targets) => {
              setObjectiveContData((prev) => {
                const featured = targets.includes(prev.featured)
                  ? prev.featured
                  : "";
                const subObjectives = prev.subObjectives.filter((sub) =>
                  targets.includes(sub.targetSlug)
                );
                return {
                  ...prev,
                  targets,
                  featured,
                  subObjectives,
                };
              });
            }}
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Featured Guide
          </FieldLabel>

          <Combobox
            items={targs}
            value={objectiveContData.featured}
            onValueChange={(featured) =>
              setObjectiveContData((prev) => ({
                ...prev,
                featured,
              }))
            }
          />
        </Field>
      </FieldGroup>
    </Stepper.Content>
  );
};
