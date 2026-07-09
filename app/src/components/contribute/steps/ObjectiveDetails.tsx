import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const ObjectiveDetails = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader title={"Objective Details"} Stepper={Stepper} />

      <h2>Objective Name</h2>
    </Stepper.Content>
  );
};
