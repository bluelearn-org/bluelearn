import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const SelectObjectiveGuides = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="objective-guides">
      <StepperActionHeader title={"Select Guides"} Stepper={Stepper} />

      <h2>Select Guides</h2>
    </Stepper.Content>
  );
};
