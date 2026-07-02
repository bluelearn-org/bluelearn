import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const Content = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="content">
      <StepperActionHeader title={"Content"} Stepper={Stepper} />

      <h2>Guide Body</h2>
    </Stepper.Content>
  );
};
