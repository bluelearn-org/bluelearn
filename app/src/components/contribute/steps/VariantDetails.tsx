import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
    Stepper: any;
};

export const VariantDetails = ({ Stepper }: PropTypes) => {
    return (
        <Stepper.Content step="variant-details">
            <StepperActionHeader title={"Variant Details"} Stepper={Stepper} />

            <h2>Variant Guide Name</h2>
        </Stepper.Content>
    )
}
