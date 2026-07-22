import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
  onSaveDraft: () => void;
  submitting?: boolean;
};

export const VariantDetails = ({
  Stepper,
  onSaveDraft,
  submitting,
}: PropTypes) => {
  return (
    <Stepper.Content step="variant-details">
      <StepperActionHeader
        title={"Variant Details"}
        Stepper={Stepper}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <h2>Variant Guide Name</h2>
    </Stepper.Content>
  );
};
