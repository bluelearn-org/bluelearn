import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
    Stepper: any;
};

export const SubjectDetails = ({ Stepper }: PropTypes) => {
    return (
        <Stepper.Content step="subject-details">
            <StepperActionHeader title={"Subject Details"} Stepper={Stepper} />

            <h2>Subject Name</h2>
        </Stepper.Content>
    )
}
