import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const SelectPathGuides = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="path-guides">
      <StepperActionHeader title={"Select Guides"} Stepper={Stepper} />

      <h2>Select Guides</h2>
    </Stepper.Content>
  );
};
