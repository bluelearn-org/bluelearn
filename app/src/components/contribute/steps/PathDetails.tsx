import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const PathDetails = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="path-details">
      <StepperActionHeader title={"Path Details"} Stepper={Stepper} />

      <h2>Path Name</h2>
    </Stepper.Content>
  );
};
