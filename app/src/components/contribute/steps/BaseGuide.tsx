import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
    Stepper: any;
};

export const BaseGuide = ({ Stepper }: PropTypes) => {
    return (
        <Stepper.Content step="base-guide">
            <StepperActionHeader title={"Base Guide"} Stepper={Stepper} />

            <h2>Base Guide</h2>
        </Stepper.Content>
    )
}
