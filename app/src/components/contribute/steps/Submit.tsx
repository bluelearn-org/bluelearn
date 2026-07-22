import "katex/dist/katex.min.css";

import { Save } from "lucide-react";

import type { GuideType, HydratedGuide } from "@/types/guides";

import { Separator } from "@/components/ui/separator";
import { GuideReader } from "@/components/GuideReader";

type PropTypes = {
  Stepper: any;
  guide: HydratedGuide;
  guideType?: GuideType;
  onSaveDraft: () => void;
  onPublish: () => void;
  submitting: boolean;
};

export const Submit = ({
  Stepper,
  guide,
  guideType,
  onSaveDraft,
  onPublish,
  submitting,
}: PropTypes) => {
  return (
    <Stepper.Content step="submit">
      {/* same header slot as the other steps, but with the draft/submit actions */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="ml-1 font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Preview
        </h1>

        <div className="text-mono flex justify-between gap-4">
          <button
            type="button"
            className="btn-sec inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={submitting}
            onClick={onSaveDraft}
          >
            <Save className="size-4" />
            Save Draft
          </button>

          <Stepper.Prev className="btn-sec">Back</Stepper.Prev>

          <button
            type="button"
            className="btn-pri disabled:pointer-events-none disabled:opacity-50"
            disabled={submitting}
            onClick={onPublish}
          >
            Submit for Review
          </button>
        </div>
      </div>

      <Separator className="mb-8 bg-border" />

      {/* same renderer the published page uses, so this is what it'll look like */}
      <GuideReader guide={guide} guideType={guideType} />
    </Stepper.Content>
  );
};
