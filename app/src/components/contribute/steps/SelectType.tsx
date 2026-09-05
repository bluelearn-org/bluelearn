import type { ContributionType } from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { useAuth } from "@/lib/authContext";

type PropTypes = {
  pickType: (type: ContributionType) => void;
  type: string | null;
  Stepper: any;
};

export const SelectType = ({ pickType, type, Stepper }: PropTypes) => {
  const { roles } = useAuth();
  const isCurator = roles.includes("curator");

  return (
    <Stepper.Content step="type">
      <StepperActionHeader
        title={"Select Contribution Type"}
        Stepper={Stepper}
        hideBackBtn={true}
        hideGuidelines={true}
      />
      <div
        className={`grid grid-cols-1 gap-4 p-4 md:grid-cols-2 ${isCurator ? "lg:grid-cols-3" : ""}`}
      >
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

        {isCurator && (
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
        )}
      </div>
    </Stepper.Content>
  );
};
