import { X } from "lucide-react";
import { useState } from "react";
import { slugify, subjectNameSchema } from "@bluelearn/schemas";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SubjectOption = { id: string; name: string };

type NewSubjectErrors = { name?: string; summary?: string };

// The API refuses these names on save with a generic 400, so catch them here
// with the same schema and slug rule.
const validateNewSubject = (
  name: string,
  summary: string
): NewSubjectErrors => {
  const errors: NewSubjectErrors = {};

  const parsedName = subjectNameSchema.safeParse(name);
  if (!parsedName.success) {
    errors.name = parsedName.error.issues[0].message;
  } else if (!slugify(name)) {
    errors.name = "Subject must contain at least one letter or number.";
  }

  if (summary === "") {
    errors.summary = "Subject summary is required.";
  }

  return errors;
};

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
  subjects: Array<SubjectOption>;
  showChangeSummary?: boolean;
  invalidFields?: ReadonlySet<string>;
  hideBackBtn?: boolean;
  onSaveDraft?: () => void;
  submitting?: boolean;
  isDirty?: boolean;
  isSynced?: boolean;
};

export const ObjectiveDetails = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
  subjects,
  showChangeSummary = false,
  invalidFields,
  hideBackBtn,
  onSaveDraft,
  submitting,
  isDirty,
  isSynced,
}: PropTypes) => {
  const invalid = (field: string) => invalidFields?.has(field) || undefined;
  const invalidClass = "border-2 border-destructive aria-invalid:ring-0";

  const [newSubject, setNewSubject] = useState<{
    name: string;
    summary: string;
  }>({ name: "", summary: "" });
  const [newSubjectErrors, setNewSubjectErrors] = useState<NewSubjectErrors>(
    {}
  );

  const addNewSubject = () => {
    const name = newSubject.name.trim();
    const summary = newSubject.summary.trim();

    const errors = validateNewSubject(name, summary);
    setNewSubjectErrors(errors);
    if (errors.name || errors.summary) return;

    setObjectiveContData((prev) => ({
      ...prev,
      newSubjects: [...prev.newSubjects, { name, summary }],
    }));

    setNewSubject({ name: "", summary: "" });
  };

  const removeNewSubject = (index: number) =>
    setObjectiveContData((prev) => ({
      ...prev,
      newSubjects: prev.newSubjects.filter((_, i) => i !== index),
    }));

  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader
        title={"Objective Details"}
        Stepper={Stepper}
        type="objective"
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
        isDirty={isDirty}
        isSynced={isSynced}
      />

      <FieldGroup className="gap-8 pt-6">
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
              Select existing subjects for this learning objective, or create
              new ones below.
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
            <FieldLabel className="mono-micro">New Subjects</FieldLabel>
            <FieldDescription className="text-xs">
              Create a subject if it doesn't exist yet.
            </FieldDescription>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Input
              id="new-subject-name"
              type="text"
              maxLength={50}
              placeholder="Enter subject name."
              aria-label="New subject name"
              className={cn(
                "h-10 rounded-md",
                newSubjectErrors.name && invalidClass
              )}
              aria-invalid={!!newSubjectErrors.name || undefined}
              aria-describedby={
                newSubjectErrors.name ? "new-subject-name-error" : undefined
              }
              value={newSubject.name}
              onChange={(e) => {
                setNewSubject((prev) => ({ ...prev, name: e.target.value }));
                setNewSubjectErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />

            <Input
              id="new-subject-summary"
              type="text"
              maxLength={500}
              placeholder="Enter summary of new subject."
              aria-label="New subject summary"
              className={cn(
                "h-10 rounded-md",
                newSubjectErrors.summary && invalidClass
              )}
              aria-invalid={!!newSubjectErrors.summary || undefined}
              aria-describedby={
                newSubjectErrors.summary
                  ? "new-subject-summary-error"
                  : undefined
              }
              value={newSubject.summary}
              onChange={(e) => {
                setNewSubject((prev) => ({ ...prev, summary: e.target.value }));
                setNewSubjectErrors((prev) => ({
                  ...prev,
                  summary: undefined,
                }));
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="btn-sec h-10 w-full rounded-md sm:w-24"
              onClick={addNewSubject}
            >
              Add Subject
            </Button>
          </div>

          <FieldError id="new-subject-name-error">
            {newSubjectErrors.name}
          </FieldError>
          <FieldError id="new-subject-summary-error">
            {newSubjectErrors.summary}
          </FieldError>

          {objectiveContData.newSubjects.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {objectiveContData.newSubjects.map((subject, index) => (
                <Badge
                  key={`${subject.name}-${index}`}
                  variant="outline"
                  className="gap-1.5"
                >
                  {subject.summary
                    ? `${subject.name} - ${subject.summary}`
                    : subject.name}

                  <button
                    type="button"
                    aria-label={`Remove ${subject.name}`}
                    title={`Remove ${subject.name}`}
                    className="rounded-full bg-transparent p-1.5 text-muted-foreground filter transition duration-150 outline-none hover:scale-105 hover:bg-muted/10 hover:text-foreground hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    onClick={() => removeNewSubject(index)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </Field>
      </FieldGroup>
    </Stepper.Content>
  );
};
