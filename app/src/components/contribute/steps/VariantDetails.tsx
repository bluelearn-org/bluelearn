// import { useState } from "react";
import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { VariantContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import subjectsData from "@/data/subjects.json";
import guidesData from "@/data/guides.json";
import { Combobox } from "@/components/ui/combobox";

type PropTypes = {
  Stepper: any;
  variantContData: VariantContribution;
  setVariantContData: Dispatch<SetStateAction<VariantContribution>>;
};

export const VariantDetails = ({
  Stepper,
  variantContData,
  setVariantContData,
}: PropTypes) => {
  const isNextDisabled = useMemo(() => {
    return (
      variantContData.title.trim() === "" ||
      variantContData.summary.trim() === "" ||
      variantContData.baseGuide.length === 0
    );
  }, [
    variantContData.title,
    variantContData.summary,
    variantContData.baseGuide,
  ]);

  return (
    <Stepper.Content step="variant-details">
      <StepperActionHeader
        title={"Variant Details"}
        Stepper={Stepper}
        nextDisabled={isNextDisabled}
      />

      <FieldGroup>
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
            value={variantContData.title}
            onChange={(e) =>
              setVariantContData((prev: any) => ({
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
            placeholder="Write a summary for your guide variant."
            required
            value={variantContData.summary}
            onChange={(e) =>
              setVariantContData((prev: any) => ({
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
            Base Guide
          </FieldLabel>

          <Combobox
            items={guidesData.map((g: any) => {
              return {
                value: g.slug,
                label: g.title,
                description: g.summary,
              };
            })}
            value={variantContData.baseGuide}
            onValueChange={(baseGuide) =>
              setVariantContData((prev: any) => ({
                ...prev,
                baseGuide,
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
            value={variantContData.subjects}
            onValueChange={(subjects) =>
              setVariantContData((prev: any) => ({
                ...prev,
                subjects,
              }))
            }
          />
        </Field>
      </FieldGroup>
    </Stepper.Content>
  );
};
