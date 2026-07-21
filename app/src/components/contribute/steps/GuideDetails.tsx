import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { GuideContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import subjectsData from "@/data/subjects.json";
import guidesData from "@/data/guides.json";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

type PropTypes = {
  Stepper: any;
  guideContData: GuideContribution;
  setGuideContData: Dispatch<SetStateAction<GuideContribution>>;
};

export const GuideDetails = ({
  Stepper,
  guideContData,
  setGuideContData,
}: PropTypes) => {
  const [todoPrereq, setTodoPrereq] = useState<string>("");
  const [newSubject, setNewSubject] = useState<{
    name: string;
    summary: string;
  }>({
    name: "",
    summary: "",
  });

  return (
    <Stepper.Content step="guide-details">
      <StepperActionHeader title={"Guide Details"} Stepper={Stepper} />

      <FieldGroup>
        <FieldLabel className="font-mono tracking-[0.08em] uppercase">
          Type
        </FieldLabel>
        <Field className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          <button
            className="mono-micro rounded-full border border-badge-border p-4 tracking-[0.08em] text-badge-foreground"
            style={{
              backgroundColor:
                guideContData.type == "theoretical"
                  ? "var(--badge-bg)"
                  : "var(--muted-bg)",
            }}
            onClick={() =>
              setGuideContData((prev) => ({
                ...prev,
                type: "theoretical",
              }))
            }
          >
            Theoretical
          </button>

          <button
            className="mono-micro rounded-full border border-badge-border p-4 tracking-[0.08em] text-badge-foreground"
            style={{
              backgroundColor:
                guideContData.type == "practical"
                  ? "var(--badge-bg)"
                  : "var(--muted-bg)",
            }}
            onClick={() =>
              setGuideContData((prev) => ({
                ...prev,
                type: "practical",
              }))
            }
          >
            Practical
          </button>
        </Field>
        <Field className="space-y-2">
          <FieldLabel
            required
            className="font-mono tracking-[0.08em] uppercase"
          >
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
            value={guideContData.title}
            onChange={(e) =>
              setGuideContData((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel
            required
            className="font-mono tracking-[0.08em] uppercase"
          >
            Summary
          </FieldLabel>

          <textarea
            className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            rows={4}
            placeholder="Write a summary for your guide."
            required
            value={guideContData.summary}
            onChange={(e) =>
              setGuideContData((prev) => ({
                ...prev,
                summary: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel
            required
            className="font-mono tracking-[0.08em] uppercase"
          >
            Subjects
          </FieldLabel>

          <Combobox
            multiple
            items={subjectsData.map((s) => {
              return {
                value: s.slug,
                label: s.name,
                description: s.summary,
              };
            })}
            value={guideContData.subjects}
            onValueChange={(subjects) =>
              setGuideContData((prev) => ({
                ...prev,
                subjects,
              }))
            }
          />
        </Field>
        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            New Subjects
          </FieldLabel>
          <div className="flex items-center justify-between gap-4">
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
              maxLength={50}
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
              variant="ghost"
              size="icon"
              className="btn-sec h-10 w-24 rounded-md"
              onClick={() => {
                if (newSubject.name !== "" && newSubject.summary !== "") {
                  const newSubs = [...guideContData.newSubjects, newSubject];
                  setGuideContData((prev) => ({
                    ...prev,
                    newSubjects: newSubs,
                  }));

                  setNewSubject({ name: "", summary: "" });
                }
              }}
            >
              Add Subject
            </Button>
          </div>
        </Field>

        <ul className="list-disc px-8 text-[11px] text-muted-foreground">
          {guideContData.newSubjects.map((sub, index) => {
            return (
              <li key={index}>
                {sub.name} - {sub.summary}
              </li>
            );
          })}
        </ul>

        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Prerequsite Guides
          </FieldLabel>

          <Combobox
            multiple
            items={guidesData.map((g) => {
              return {
                value: g.slug,
                label: g.title,
                description: g.summary,
              };
            })}
            value={guideContData.prereqs}
            onValueChange={(prereqs) =>
              setGuideContData((prev) => ({
                ...prev,
                prereqs,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <FieldLabel className="font-mono tracking-[0.08em] uppercase">
            Todo Prerequsite Guides
          </FieldLabel>

          <div className="flex items-center justify-between gap-4">
            <Input
              id="todo-prereqs"
              type="text"
              maxLength={50}
              placeholder="Enter title of missing prerequsite guide."
              className="h-10 rounded-md"
              value={todoPrereq}
              onChange={(e) => setTodoPrereq(e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="btn-sec h-10 w-24 rounded-md"
              onClick={() => {
                if (todoPrereq !== "") {
                  const todos = [...guideContData.todoPrereqs, todoPrereq];
                  setGuideContData((prev) => ({
                    ...prev,
                    todoPrereqs: todos,
                  }));

                  setTodoPrereq("");
                }
              }}
            >
              Add Guide
            </Button>
          </div>
        </Field>
        <ul className="list-disc px-8 text-[11px] text-muted-foreground">
          {guideContData.todoPrereqs.map((todo, index) => {
            return <li key={index}>{todo}</li>;
          })}
        </ul>
      </FieldGroup>
    </Stepper.Content>
  );
};
