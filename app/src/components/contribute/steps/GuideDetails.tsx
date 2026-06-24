import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
    Stepper: any;
};

export const GuideDetails = ({ Stepper }: PropTypes) => {
    return (
        <Stepper.Content step="guide-details">
            <StepperActionHeader title={"Guide Details"} Stepper={Stepper} />

            <h2>Guide Title</h2>
        </Stepper.Content>
    )
}
