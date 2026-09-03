import { X } from "lucide-react";
import { useState } from "react";
import type { VariantContribution } from "@/types/contributions";
import type { listGuides } from "@/lib/api/guides";
import type { listSubjects } from "@/lib/api/subjects";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";

type PropTypes = {
  variantContData: VariantContribution;
  onVariantChange: (update: Partial<VariantContribution>) => void;

  guides: Awaited<ReturnType<typeof listGuides>>;
  subjects: Awaited<ReturnType<typeof listSubjects>>;
};

export const VariantDetails = ({
  variantContData,
  onVariantChange,
  guides,
  subjects,
}: PropTypes) => {
  const [newSubject, setNewSubject] = useState<{
    name: string;
    summary: string;
  }>({ name: "", summary: "" });

  return (
    <FieldGroup>
      <Field className="space-y-2">
        <div className="space-y-1">
          <FieldLabel
            required
            className="font-mono text-[14px] tracking-[0.08em] uppercase"
          >
            Title
          </FieldLabel>
          <FieldDescription className="text-xs">
            A clear, concise name for your variant.
          </FieldDescription>
        </div>

        <Input
          id="title"
          type="text"
          autoComplete="Title"
          maxLength={50}
          placeholder="Choose a title. (Maximum 50 characters)."
          className="h-10 rounded-md"
          required
          value={variantContData.title}
          onChange={(e) => onVariantChange({ title: e.target.value })}
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
            Briefly describe what makes this take on the topic different.
          </FieldDescription>
        </div>

        <textarea
          className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          rows={4}
          maxLength={500}
          placeholder="Write a summary for your guide variant."
          required
          value={variantContData.summary}
          onChange={(e) => onVariantChange({ summary: e.target.value })}
        />
      </Field>

      <Field className="space-y-2">
        <div className="space-y-1">
          <FieldLabel
            required
            className="font-mono text-[14px] tracking-[0.08em] uppercase"
          >
            Base Guide
          </FieldLabel>
          <FieldDescription className="text-xs">
            The existing guide your variant offers a different approach to.
          </FieldDescription>
        </div>

        <Combobox
          items={guides
            .filter(
              (g): g is typeof g & { slug: string } =>
                !!g.slug && !g.is_official
            )
            .map((g) => {
              return {
                value: g.slug,
                label: g.title ?? g.slug,
                description: g.summary ?? undefined,
              };
            })}
          value={variantContData.baseGuide}
          onValueChange={(baseGuide) => onVariantChange({ baseGuide })}
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
            Subjects are flat tags for categorizing guide content. At least one
            subject is required.
          </p>
          <Separator />
        </div>

        <Field className="py-2">
          <div className="space-y-1">
            <FieldLabel className="font-mono tracking-[0.08em] uppercase">
              Existing Subjects
            </FieldLabel>
            <FieldDescription className="text-xs">
              Select existing subjects or add a new subject below. At least one
              is required.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            items={subjects.map((s) => {
              return {
                value: s.id,
                label: s.name,
                description: s.summary ?? "",
              };
            })}
            value={variantContData.subjects}
            onValueChange={(ids) => onVariantChange({ subjects: ids })}
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
              variant="ghost"
              size="icon"
              className="btn-sec h-10 w-full rounded-md sm:w-24"
              onClick={() => {
                if (
                  newSubject.name.trim() !== "" &&
                  newSubject.summary.trim() !== ""
                ) {
                  onVariantChange({
                    newSubjects: [...variantContData.newSubjects, newSubject],
                  });
                  setNewSubject({ name: "", summary: "" });
                }
              }}
            >
              Add Subject
            </Button>
          </div>
        </Field>

        {variantContData.newSubjects.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {variantContData.newSubjects.map((sub, index) => (
              <Badge key={index} variant="outline" className="gap-1.5">
                {sub.summary ? `${sub.name} - ${sub.summary}` : sub.name}
                <button
                  type="button"
                  aria-label={`Remove ${sub.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onVariantChange({
                      newSubjects: variantContData.newSubjects.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </FieldGroup>
  );
};
