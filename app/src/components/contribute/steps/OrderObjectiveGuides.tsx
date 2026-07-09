import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
};

export const OrderObjectiveGuides = ({ Stepper }: PropTypes) => {
  return (
    <Stepper.Content step="objective-ordering">
      <StepperActionHeader title={"Order Guides"} Stepper={Stepper} />

      <h2>Order Guides</h2>
    </Stepper.Content>
  );
};
