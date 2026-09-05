import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";

type SubjectOption = { id: string; name: string };
type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
  subjects: Array<SubjectOption>;
  guides: Array<GuideOption>;
  showChangeSummary?: boolean;
  invalidFields?: ReadonlySet<string>;
  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
};

export const ObjectiveDetails = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
  subjects,
  guides,
  showChangeSummary = false,
  invalidFields,
  hideBackBtn,
  onSaveDraft,
  submitting,
}: PropTypes) => {
  const invalid = (field: string) => invalidFields?.has(field) || undefined;
  const invalidClass = "border-2 border-destructive aria-invalid:ring-0";

  const guideItems = guides
    .filter((g): g is GuideOption & { slug: string } => !!g.slug)
    .map((g) => {
      return {
        value: g.slug,
        label: g.title ?? g.slug,
        description: g.summary ?? undefined,
      };
    });

  const targs = useMemo(
    () =>
      guideItems.filter((item) =>
        objectiveContData.targets.includes(item.value)
      ),
    [guideItems, objectiveContData.targets]
  );

  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader
        title={"Objective Details"}
        Stepper={Stepper}
        type="objective"
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <FieldGroup>
        {showChangeSummary && (
          <Field className="space-y-2">
            <div className="space-y-1">
              <FieldLabel required className="mono-micro">
                Change Summary
              </FieldLabel>
              <FieldDescription className="text-xs">
                Briefly describe what this revision changes.
              </FieldDescription>
            </div>

            <Textarea
              className={cn(
                "h-24 w-full min-w-0 resize-none",
                invalid("changeSummary") && invalidClass
              )}
              rows={3}
              maxLength={500}
              placeholder="Describe what changed."
              aria-invalid={invalid("changeSummary")}
              value={objectiveContData.changeSummary}
              onChange={(e) =>
                setObjectiveContData((prev) => ({
                  ...prev,
                  changeSummary: e.target.value,
                }))
              }
            />
          </Field>
        )}

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
            className={cn("h-10 rounded-md", invalid("title") && invalidClass)}
            required
            aria-invalid={invalid("title")}
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
            className={cn(
              "h-32 w-full min-w-0 resize-none",
              invalid("summary") && invalidClass
            )}
            rows={4}
            maxLength={500}
            placeholder="Write a summary for the objective."
            required
            aria-invalid={invalid("summary")}
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
              Select existing subjects for this learning objective.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            invalid={invalid("subjects")}
            items={subjects.map((s) => {
              return {
                value: s.id,
                label: s.name,
              };
            })}
            value={objectiveContData.subjects}
            onValueChange={(ids) =>
              setObjectiveContData((prev) => ({
                ...prev,
                subjects: ids,
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
            invalid={invalid("targets")}
            items={guideItems}
            value={objectiveContData.targets}
            onValueChange={(targets) => {
              setObjectiveContData((prev) => {
                const featuredSubObjective = targets.includes(
                  prev.featuredSubObjective
                )
                  ? prev.featuredSubObjective
                  : "";
                const subObjectives = prev.subObjectives.filter((sub) =>
                  targets.includes(sub.targetSlug)
                );
                return {
                  ...prev,
                  targets,
                  featuredSubObjective,
                  subObjectives,
                };
              });
            }}
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Featured Sub-Objective
            </FieldLabel>
            <FieldDescription className="text-xs">
              {targs.length === 0
                ? "Select at least one Target Guide above first."
                : "The primary target guide to showcase on the objective card."}
            </FieldDescription>
          </div>

          <Combobox
            disabled={targs.length === 0}
            invalid={invalid("featuredSubObjective")}
            items={targs}
            value={objectiveContData.featuredSubObjective}
            onValueChange={(featuredSubObjective) =>
              setObjectiveContData((prev) => ({
                ...prev,
                featuredSubObjective,
              }))
            }
          />
        </Field>
      </FieldGroup>
    </Stepper.Content>
  );
};
