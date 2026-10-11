// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { ObjectiveDetails } from "@/components/contribute/steps/objective/ObjectiveDetails";
import { objectiveContributionSchema } from "@/types/contributions";

vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: () => null,
}));

afterEach(cleanup);

const subjects = [{ id: "algebra-id", name: "Algebra" }];

function renderDetails(initial: Partial<ObjectiveContribution> = {}) {
  const state: { current: ObjectiveContribution | null } = { current: null };

  function Harness() {
    const [data, setData] = useState(() =>
      objectiveContributionSchema.parse({
        title: "Homestead",
        summary: "Learn to build a homestead.",
        changeSummary: "",
        targets: [],
        featuredSubObjective: "",
        subObjectives: [],
        subjects: ["algebra-id"],
        ...initial,
      })
    );

    state.current = data;

    return (
      <ObjectiveDetails
        Stepper={{
          Content: ({ children }: { children: ReactNode }) => children,
        }}
        objectiveContData={data}
        setObjectiveContData={setData}
        subjects={subjects}
      />
    );
  }

  render(<Harness />);

  return state;
}

function propose(name: string, summary: string) {
  fireEvent.change(screen.getByPlaceholderText("Enter subject name."), {
    target: { value: name },
  });
  fireEvent.change(
    screen.getByPlaceholderText("Enter summary of new subject."),
    { target: { value: summary } }
  );

  fireEvent.click(screen.getByRole("button", { name: "Add Subject" }));
}

describe("ObjectiveDetails new subjects", () => {
  it("adds a proposed subject beside the selected existing one", () => {
    const state = renderDetails();

    propose("Soil Science", "How soil feeds plants");

    expect(
      screen.getByText("Soil Science - How soil feeds plants")
    ).toBeTruthy();

    expect(state.current?.newSubjects).toEqual([
      { name: "Soil Science", summary: "How soil feeds plants" },
    ]);
    expect(state.current?.subjects).toEqual(["algebra-id"]);

    expect(screen.getByPlaceholderText("Enter subject name.").value).toBe("");
  });

  it("does not add a subject without a summary", () => {
    const state = renderDetails();

    propose("Soil Science", "   ");

    expect(state.current?.newSubjects).toEqual([]);
    expect(screen.queryByLabelText("Remove Soil Science")).toBeNull();
  });

  it("removes only the chip that was dismissed", () => {
    const state = renderDetails({
      newSubjects: [
        { id: "pending-id", name: "Composting", summary: "Saved earlier" },
      ],
    });

    propose("Soil Science", "How soil feeds plants");

    fireEvent.click(screen.getByLabelText("Remove Soil Science"));

    expect(state.current?.newSubjects).toEqual([
      { id: "pending-id", name: "Composting", summary: "Saved earlier" },
    ]);
    expect(screen.getByText("Composting - Saved earlier")).toBeTruthy();
    expect(
      screen.queryByText("Soil Science - How soil feeds plants")
    ).toBeNull();
  });
});
