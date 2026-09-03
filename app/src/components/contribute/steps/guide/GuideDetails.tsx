import { X } from "lucide-react";
import { useState } from "react";
import { normalizeTodoTitle, todoPrereqSchema } from "@bluelearn/schemas";

import type {
  ContributionType,
  GuideContribution,
} from "@/types/contributions";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";

type SubjectOption = {
  id: string;
  name: string;
};

type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

/**
 * A guide being edited inside the contribution flow.
 *
 * localDraftId identifies the guide locally in this browser.
 * revisionId identifies its server-side revision, if one exists.
 */
export type GuideWithId = GuideContribution & {
  localDraftId: string;
  revisionId: string | null;
};

type PropTypes = {
  type: ContributionType | null;

  /**
   * Currently active guide.
   */
  guideContData: GuideContribution;

  /**
   * Updates the currently active guide.
   * The identity fields are deliberately not exposed as editable fields.
   */
  onGuideChange: (update: Partial<GuideContribution>) => void;
  subjects: Array<SubjectOption>;
  guides: Array<GuideOption>;

  onSaveDraft: () => void;

  /**
   * Prerequisites and TODO prerequisites belong to the guide base
   * They are only editable while creating/editing the base guide
   */
  showBaseFields?: boolean;

  hideBackBtn?: boolean;

  changeSummary?: string;
  onChangeSummaryChange?: (value: string) => void;
};

export const GuideDetails = ({
  guideContData,
  onGuideChange,
  subjects,
  guides,
  showBaseFields = true,
  changeSummary,
  onChangeSummaryChange,
}: PropTypes) => {
  const [todoPrereq, setTodoPrereq] = useState<{
    title: string;
    summary: string;
  }>({ title: "", summary: "" });

  const [todoPrereqError, setTodoPrereqError] = useState<{
    field: "title" | "summary";
    message: string;
  } | null>(null);

  const [newSubject, setNewSubject] = useState<{
    name: string;
    summary: string;
  }>({ name: "", summary: "" });

  return (
    <div>
      <FieldGroup>
        {showBaseFields && (
          <>
            <div className="space-y-1">
              {onChangeSummaryChange && (
                <Field className="space-y-2">
                  <div className="space-y-1">
                    <FieldLabel
                      required
                      className="font-mono text-[14px] tracking-[0.08em] uppercase"
                    >
                      Change Summary
                    </FieldLabel>

                    <FieldDescription className="text-xs">
                      Briefly describe what this revision changes.
                    </FieldDescription>
                  </div>

                  <textarea
                    className="h-24 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30"
                    rows={3}
                    maxLength={500}
                    placeholder="Describe what changed."
                    value={changeSummary ?? ""}
                    onChange={(e) => onChangeSummaryChange(e.target.value)}
                  />
                </Field>
              )}

              <FieldLabel
                required
                className="font-mono text-[14px] tracking-[0.08em] uppercase"
              >
                Type
              </FieldLabel>

              <FieldDescription className="text-xs">
                Choose whether this guide explains a concept or teaches a
                process for accomplishing a goal.
              </FieldDescription>
            </div>

            <Field className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button
                type="button"
                className="mono-micro rounded-full border border-badge-border p-3 tracking-[0.08em] text-badge-foreground sm:p-4"
                style={{
                  backgroundColor:
                    guideContData.type === "theoretical"
                      ? "var(--badge-bg)"
                      : "var(--muted-bg)",
                }}
                onClick={() => onGuideChange({ type: "theoretical" })}
              >
                Theoretical
              </button>

              <button
                type="button"
                className="mono-micro rounded-full border border-badge-border p-3 tracking-[0.08em] text-badge-foreground sm:p-4"
                style={{
                  backgroundColor:
                    guideContData.type === "practical"
                      ? "var(--badge-bg)"
                      : "var(--muted-bg)",
                }}
                onClick={() => onGuideChange({ type: "practical" })}
              >
                Practical
              </button>
            </Field>
          </>
        )}

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel
              required
              className="font-mono text-[14px] tracking-[0.08em] uppercase"
            >
              Title
            </FieldLabel>

            <FieldDescription className="text-xs">
              A clear, concise name for your guide.
            </FieldDescription>
          </div>

          <Input
            id="title"
            type="text"
            autoComplete="title"
            maxLength={100}
            placeholder="Choose a title. (Maximum 100 characters)."
            className="h-10 rounded-md"
            required
            value={guideContData.title}
            onChange={(e) =>
              onGuideChange({
                title: e.target.value,
              })
            }
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel
              required
              className="font-mono text-[14px] tracking-[0.08em] uppercase"
            >
              Summary
            </FieldLabel>

            <FieldDescription className="text-xs">
              Briefly describe what the reader will learn from this guide.
            </FieldDescription>
          </div>

          <textarea
            className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            rows={4}
            placeholder="Write a summary for your guide."
            required
            value={guideContData.summary}
            onChange={(e) => onGuideChange({ summary: e.target.value })}
          />
        </Field>

        <div className="py-2">
          <div className="py-2">
            <h2 className="flex font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
              Subjects
              <span className="ml-1 self-start text-[0.9em] leading-none text-destructive">
                *
              </span>
            </h2>

            <p className="py-1 text-xs text-muted-foreground">
              Subjects are flat tags for categorizing guide content. At least
              one subject is required.
            </p>
            <Separator />
          </div>

          <Field className="py-2">
            <div className="space-y-1">
              <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                Existing Subjects
              </FieldLabel>

              <FieldDescription className="text-xs">
                Select from existing subjects.
              </FieldDescription>
            </div>

            <Combobox
              multiple
              items={subjects.map((subject) => ({
                value: subject.id,
                label: subject.name,
              }))}
              value={guideContData.subjects}
              onValueChange={(ids) => onGuideChange({ subjects: ids })}
            />
          </Field>

          <Field className="py-2">
            <div className="space-y-1">
              <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                New Subjects
              </FieldLabel>

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
                className="h-10 rounded-md"
                value={newSubject.name}
                onChange={(e) =>
                  setNewSubject((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />

              <Input
                id="new-subject-summary"
                type="text"
                maxLength={500}
                placeholder="Enter summary of new subject."
                className="h-10 rounded-md"
                value={newSubject.summary}
                onChange={(e) =>
                  setNewSubject((prev) => ({
                    ...prev,
                    summary: e.target.value,
                  }))
                }
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="btn-sec h-10 w-full rounded-md sm:w-24"
                onClick={() => {
                  if (
                    newSubject.name.trim() !== "" &&
                    newSubject.summary.trim() !== ""
                  ) {
                    onGuideChange({
                      newSubjects: [
                        ...guideContData.newSubjects,
                        {
                          name: newSubject.name,
                          summary: newSubject.summary,
                        },
                      ],
                    });

                    setNewSubject({ name: "", summary: "" });
                  }
                }}
              >
                Add Subject
              </Button>
            </div>
          </Field>

          {guideContData.newSubjects.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {guideContData.newSubjects.map((subject, index) => (
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
                    onClick={() =>
                      onGuideChange({
                        newSubjects: guideContData.newSubjects.filter(
                          (_, i) => i !== index
                        ),
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {showBaseFields && (
          <div className="py-2">
            <div className="py-2">
              <h2 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
                Prerequisite Guides
              </h2>

              <p className="py-1 text-xs text-muted-foreground">
                Recommended reading for learners. These are guides a learner
                should read and understand in order to fully understand the
                contents of this guide.
              </p>

              <Separator />
            </div>

            <Field className="py-2">
              <div className="space-y-1">
                <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                  Existing Prerequisite Guides
                </FieldLabel>

                <FieldDescription className="text-xs">
                  Select from existing guides.
                </FieldDescription>
              </div>

              <Combobox
                multiple
                items={guides
                  .filter(
                    (guide): guide is GuideOption & { slug: string } =>
                      !!guide.slug
                  )
                  .map((guide) => ({
                    value: guide.slug,
                    label: guide.title ?? guide.slug,
                    description: guide.summary ?? undefined,
                  }))}
                value={guideContData.prereqs}
                onValueChange={(prereqs) => onGuideChange({ prereqs })}
              />
            </Field>

            <Field className="py-2">
              <div className="space-y-1">
                <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                  Todo Prerequisite Guides
                </FieldLabel>

                <FieldDescription className="text-xs">
                  Some guides don't exist, todo prerequisite guides are
                  recommended reading material that don't currently exist.
                </FieldDescription>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Input
                  id="todo-prereqs"
                  type="text"
                  maxLength={50}
                  placeholder="Enter title of missing prerequisite guide."
                  className={`h-10 ${
                    todoPrereqError
                      ? "outline-2 outline-offset-2 outline-destructive"
                      : ""
                  }`}
                  value={todoPrereq.title}
                  onChange={(e) => {
                    setTodoPrereqError(null);

                    setTodoPrereq((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }));
                  }}
                  aria-invalid={!!todoPrereqError}
                  aria-describedby={
                    todoPrereqError ? "todo-prereq-error" : undefined
                  }
                />

                <Input
                  id="todo-prereq-summary"
                  type="text"
                  maxLength={500}
                  placeholder="Enter summary of missing prerequisite guide."
                  className={`h-10 ${
                    todoPrereqError
                      ? "outline-2 outline-offset-2 outline-destructive"
                      : ""
                  }`}
                  value={todoPrereq.summary}
                  onChange={(e) => {
                    setTodoPrereqError(null);

                    setTodoPrereq((prev) => ({
                      ...prev,
                      summary: e.target.value,
                    }));
                  }}
                  aria-invalid={!!todoPrereqError}
                  aria-describedby={
                    todoPrereqError ? "todo-prereq-error" : undefined
                  }
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="btn-sec h-10 w-full rounded-md sm:w-24"
                  onClick={() => {
                    const result = todoPrereqSchema.safeParse(todoPrereq);

                    if (!result.success) {
                      const issue = result.error.issues[0];

                      const field =
                        issue.path[0] === "summary" ? "summary" : "title";

                      setTodoPrereqError({ field, message: issue.message });

                      return;
                    }

                    const normalizedTitle = normalizeTodoTitle(
                      result.data.title
                    );

                    const alreadyExists = guideContData.todoPrereqs.some(
                      (todo) =>
                        normalizeTodoTitle(todo.title) === normalizedTitle
                    );

                    if (alreadyExists) {
                      setTodoPrereqError({
                        field: "title",
                        message:
                          "A TODO prerequisite with this title already exists.",
                      });

                      return;
                    }

                    onGuideChange({
                      todoPrereqs: [...guideContData.todoPrereqs, result.data],
                    });

                    setTodoPrereq({ title: "", summary: "" });

                    setTodoPrereqError(null);
                  }}
                >
                  Add Todo
                </Button>
              </div>

              <FieldError id="todo-prereq-error">
                {todoPrereqError ? todoPrereqError.message : null}
              </FieldError>
            </Field>

            {guideContData.todoPrereqs.length > 0 && (
              <div className="flex flex-col gap-2 px-1">
                {guideContData.todoPrereqs.map((todo, index) => (
                  <div
                    key={`${todo.title}-${index}`}
                    className="flex h-auto w-full items-start justify-between gap-1.5 rounded-md border border-input/20 px-3 py-1.5 text-left break-words whitespace-normal"
                  >
                    <span className="min-w-0 flex-1 pr-2">
                      <div className="break-words">
                        <div>
                          <span className="font-semibold">{todo.title}</span>
                        </div>

                        {todo.summary && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {todo.summary}
                          </div>
                        )}
                      </div>
                    </span>

                    <button
                      type="button"
                      aria-label={`Remove ${todo.title}`}
                      className="flex-shrink-0 rounded-full bg-transparent p-1.5 text-muted-foreground filter transition duration-150 outline-none hover:scale-105 hover:bg-muted/10 hover:text-foreground hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      onClick={() =>
                        onGuideChange({
                          todoPrereqs: guideContData.todoPrereqs.filter(
                            (_, i) => i !== index
                          ),
                        })
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FieldGroup>
    </div>
  );
};
