import type { DisclaimerSlug } from "@bluelearn/schemas";

import { Combobox } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { DISCLAIMER_OPTIONS } from "@/lib/disclaimers";

type PropTypes = {
  value: Array<DisclaimerSlug>;
  onChange: (disclaimers: Array<DisclaimerSlug>) => void;
  description?: string;
};

export function DisclaimersField({
  value,
  onChange,
  description = "Select content-category disclaimers that apply to this guide.",
}: PropTypes) {
  return (
    <Field className="py-2">
      <div className="space-y-1">
        <FieldLabel className="font-mono text-[14px] tracking-[0.08em] uppercase">
          Disclaimers
        </FieldLabel>

        <FieldDescription className="text-xs">{description}</FieldDescription>
      </div>

      <Combobox
        multiple
        items={DISCLAIMER_OPTIONS}
        value={value}
        onValueChange={(disclaimers) =>
          onChange(disclaimers as Array<DisclaimerSlug>)
        }
      />
    </Field>
  );
}
