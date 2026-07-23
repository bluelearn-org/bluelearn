import "katex/dist/katex.min.css";

import { Separator } from "@/components/ui/separator";
import { GuideReader } from "@/components/GuideReader";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
  guide: any; // TODO: fix this type
  guideType?: any; // TODO: fix this type
  onSaveDraft: () => void;
  onPublish: () => void;
  submitting: boolean;
};

export const PreviewGuide = ({
  Stepper,
  guide,
  guideType,
  onSaveDraft,
  onPublish,
  submitting,
}: PropTypes) => {
  return (
    <Stepper.Content step="preview-guide">
      <StepperActionHeader
        title={"Preview"}
        Stepper={Stepper}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        submitting={submitting}
      />

      <Separator className="mb-8 bg-border" />

      {/* same renderer the published page uses, so this is what it'll look like */}
      <GuideReader guide={guide} guideType={guideType} />
    </Stepper.Content>
  );
};
