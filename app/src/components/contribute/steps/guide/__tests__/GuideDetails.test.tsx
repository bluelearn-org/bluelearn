// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GuideContribution } from "@/types/contributions";

import { GuideDetails } from "@/components/contribute/steps/guide/GuideDetails";

const guide: GuideContribution = {
  type: "theoretical",
  title: "Binary search",
  summary: "Find a value in sorted data.",
  body: "",
  subjects: [],
  newSubjects: [],
  prereqs: [],
  requests: [],
  disclaimers: [],
};

afterEach(cleanup);

describe("GuideDetails when editing a guide", () => {
  it("shows the change summary above the title when base fields are hidden", () => {
    const onChangeSummaryChange = vi.fn();

    render(
      <GuideDetails
        type="variant"
        guideContData={guide}
        onGuideChange={() => {}}
        subjects={[]}
        guides={[]}
        onSaveDraft={() => {}}
        showBaseFields={false}
        changeSummary="Clarify the example"
        onChangeSummaryChange={onChangeSummaryChange}
      />
    );

    const changeSummaryLabel = screen.getByText("Change Summary");
    const titleLabel = screen.getByText("Title");
    expect(
      changeSummaryLabel.compareDocumentPosition(titleLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const changeSummary = screen.getByPlaceholderText("Describe what changed.");
    expect((changeSummary as HTMLTextAreaElement).value).toBe(
      "Clarify the example"
    );

    fireEvent.change(changeSummary, {
      target: { value: "Explain the edge case" },
    });
    expect(onChangeSummaryChange).toHaveBeenCalledWith("Explain the edge case");
  });
});
