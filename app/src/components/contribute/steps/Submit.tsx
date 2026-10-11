import "katex/dist/katex.min.css";

import type { GuideType } from "@/types/guides";

import type { ReaderGuide } from "@/components/GuideReader";
import { GuideReader } from "@/components/GuideReader";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
  guide: ReaderGuide;
  guideType?: GuideType;
  onSaveDraft: () => void;
  onPublish: () => void;
  submitting: boolean;
  isDirty?: boolean;
  title?: string;
  publishLabel?: string;
};

export const Submit = ({
  Stepper,
  guide,
  guideType,
  onSaveDraft,
  onPublish,
  submitting,
  isDirty,
  title = "Preview",
  publishLabel = "Submit for Review",
}: PropTypes) => {
  return (
    <Stepper.Content step="submit">
      <StepperActionHeader
        title={title}
        Stepper={Stepper}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        submitting={submitting}
        isDirty={isDirty}
        publishLabel={publishLabel}
      />

      <GuideReader guide={guide} guideType={guideType} />
    </Stepper.Content>
  );
};
