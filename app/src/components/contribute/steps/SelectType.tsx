import type { ContributionType } from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
    pickType: (type: ContributionType) => void;
    type: string | null;
    Stepper: any;
};

export const SelectType = ({ pickType, type, Stepper }: PropTypes) => {
    return (
        <Stepper.Content step="type">
            <StepperActionHeader title={"Select Contribution Type"} Stepper={Stepper} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                    className="text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em] p-4"
                    style={{ backgroundColor: type == "subject" ? "var(--badge-bg)" : "var(--muted-bg)" }}
                    onClick={() => pickType("subject")}
                >
                    Subject
                </button>

                <button
                    className="text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em] p-4"
                    style={{ backgroundColor: type == "guide" ? "var(--badge-bg)" : "var(--muted-bg)" }}
                    onClick={() => pickType("guide")}
                >
                    Guide
                </button>

                <button
                    className="text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em] p-4"
                    style={{ backgroundColor: type == "variant" ? "var(--badge-bg)" : "var(--muted-bg)" }}
                    onClick={() => pickType("variant")}
                >
                    Variant
                </button>

                <button
                    className="text-badge-foreground border border-badge-border rounded-full mono-micro tracking-[0.08em] p-4"
                    style={{ backgroundColor: type == "path" ? "var(--badge-bg)" : "var(--muted-bg)" }}
                    onClick={() => pickType("path")}
                >
                    Path
                </button>
            </div>
        </Stepper.Content>
    );
};