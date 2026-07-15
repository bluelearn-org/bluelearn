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
      <StepperActionHeader
        title={"Select Contribution Type"}
        Stepper={Stepper}
      />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        <button
          className="mono-micro rounded-full border border-badge-border p-4 tracking-[0.08em] text-badge-foreground"
          style={{
            backgroundColor:
              type == "guide" ? "var(--badge-bg)" : "var(--muted-bg)",
          }}
          onClick={() => pickType("guide")}
        >
          Guide
        </button>

        <button
          className="mono-micro rounded-full border border-badge-border p-4 tracking-[0.08em] text-badge-foreground"
          style={{
            backgroundColor:
              type == "variant" ? "var(--badge-bg)" : "var(--muted-bg)",
          }}
          onClick={() => pickType("variant")}
        >
          Variant
        </button>

        <button
          className="mono-micro rounded-full border border-badge-border p-4 tracking-[0.08em] text-badge-foreground"
          style={{
            backgroundColor:
              type == "objective" ? "var(--badge-bg)" : "var(--muted-bg)",
          }}
          onClick={() => pickType("objective")}
        >
          Objective
        </button>
      </div>
    </Stepper.Content>
  );
};
