import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";

import guidesData from "@/data/guides.json";
import subjectsData from "@/data/subjects.json";

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
  const [showErrors, setShowErrors] = useState(false);
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
    return (
      objectiveContData.title.trim() === "" ||
      objectiveContData.summary.trim() === "" ||
      objectiveContData.subjects.length === 0 ||
      objectiveContData.targets.length === 0 ||
      !objectiveContData.featured
    );
  }, [
    objectiveContData.title,
    objectiveContData.summary,
    objectiveContData.subjects,
    objectiveContData.targets,
    objectiveContData.featured,
  ]);

  const handleNextClick = (e: React.MouseEvent) => {
    if (isNextDisabled) {
      e.preventDefault();
      setShowErrors(true);
      toast.error("Please fill out all required fields.");
    }
  };

  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader
        title={"Objective Details"}
        Stepper={Stepper}
        onNextClick={handleNextClick}
      />

      <FieldGroup>
        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Title
            </FieldLabel>
            <FieldDescription className="text-xs">
              A clear, concise name for this learning objective.
            </FieldDescription>
          </div>

          <Input
            id="title"
            type="text"
            autoComplete="Title"
            maxLength={50}
            placeholder="Choose a title. (Maximum 50 characters)."
            className={`h-10 rounded-md ${
              showErrors && !objectiveContData.title.trim()
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }`}
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
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Summary
            </FieldLabel>
            <FieldDescription className="text-xs">
              Briefly describe what the learner will achieve by completing this
              objective.
            </FieldDescription>
          </div>

          <Textarea
            className={`h-32 w-full min-w-0 resize-none ${
              showErrors && !objectiveContData.summary.trim()
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }`}
            rows={4}
            maxLength={250}
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
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Subjects
            </FieldLabel>
            <FieldDescription className="text-xs">
              Select at least one subject this objective falls under.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            className={
              showErrors && objectiveContData.subjects.length === 0
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }
            items={subjectsData.map((s) => ({
              value: s.slug,
              label: s.name,
              description: s.summary,
            }))}
            value={objectiveContData.subjects}
            onValueChange={(subjects) =>
              setObjectiveContData((prev) => ({
                ...prev,
                subjects,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Target Guides
            </FieldLabel>
            <FieldDescription className="text-xs">
              Select the guides you think would be appropriate for this learning
              objective.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            className={
              showErrors && objectiveContData.targets.length === 0
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }
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
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Featured Guide
            </FieldLabel>
            <FieldDescription className="text-xs">
              {targs.length === 0
                ? "Select at least one Target Guide above first."
                : "The primary target guide to showcase on the objective card."}
            </FieldDescription>
          </div>

          <Combobox
            disabled={targs.length === 0}
            className={
              showErrors && !objectiveContData.featured
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }
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
