import { Separator } from "@/components/ui/separator";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
  // objective: any;// TODO: uncomment and fix this type
  onPublish: () => void;
  submitting: boolean;
};

export const PreviewObjective = ({
  Stepper,
  // objective,// TODO: uncomment and pass in the data
  onPublish,
  submitting,
}: PropTypes) => {
  return (
    <Stepper.Content step="preview-objective">
      <StepperActionHeader
        title={"Preview Guide"}
        Stepper={Stepper}
        onPublish={onPublish}
        submitting={submitting}
      />

      <Separator className="mb-8 bg-border" />
    </Stepper.Content>
  );
};
