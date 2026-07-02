import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const Submit = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="submit">
      <StepperActionHeader title={"Submit"} Stepper={Stepper} />
    </Stepper.Content>
  );
};
