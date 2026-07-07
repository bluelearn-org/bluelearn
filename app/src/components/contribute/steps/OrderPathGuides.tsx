import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const OrderPathGuides = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="path-ordering">
      <StepperActionHeader title={"Order Guides"} Stepper={Stepper} />

      <h2>Order Guides</h2>
    </Stepper.Content>
  );
};
