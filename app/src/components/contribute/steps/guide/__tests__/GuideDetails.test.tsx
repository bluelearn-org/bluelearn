// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("selects, removes, restores, and isolates disclaimers for the active draft", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const scrollDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollIntoView"
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    onTestFinished(() => {
      if (scrollDescriptor) {
        Object.defineProperty(
          Element.prototype,
          "scrollIntoView",
          scrollDescriptor
        );
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    });
    const firstGuide: GuideContribution = {
      ...guide,
      disclaimers: ["medical"],
    };
    const secondGuide: GuideContribution = {
      ...guide,
      title: "Graph traversal",
      disclaimers: [],
    };

    const Harness = () => {
      const [active, setActive] = useState<"first" | "second">("first");
      const [first, setFirst] = useState(firstGuide);
      const [second, setSecond] = useState(secondGuide);
      const activeGuide = active === "first" ? first : second;
      const setActiveGuide = active === "first" ? setFirst : setSecond;

      return (
        <>
          <button
            type="button"
            onClick={() =>
              setActive((current) => (current === "first" ? "second" : "first"))
            }
          >
            Switch guide
          </button>
          <GuideDetails
            type="guide"
            guideContData={activeGuide}
            onGuideChange={(update) =>
              setActiveGuide((current) => ({ ...current, ...update }))
            }
            subjects={[]}
            guides={[]}
            onSaveDraft={() => {}}
          />
        </>
      );
    };

    render(<Harness />);

    const disclaimerField = screen
      .getByText("Disclaimers")
      .closest("div")!.parentElement!;
    expect(screen.queryByText("Medical")).not.toBeNull();

    fireEvent.click(
      within(disclaimerField).getByRole("button", { name: /select/i })
    );
    fireEvent.click(screen.getByText("Financial"));
    fireEvent.click(
      within(disclaimerField).getByRole("button", { name: /select/i })
    );
    expect(screen.queryByText("Medical")).not.toBeNull();
    expect(screen.queryByText("Financial")).not.toBeNull();

    fireEvent.click(
      within(disclaimerField).getByRole("button", { name: "Remove Medical" })
    );
    expect(screen.queryByText("Medical")).toBeNull();
    expect(screen.queryByText("Financial")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Switch guide" }));
    expect(screen.queryByText("Medical")).toBeNull();
    expect(screen.queryByText("Financial")).toBeNull();

    fireEvent.click(
      within(
        screen.getByText("Disclaimers").closest("div")!.parentElement!
      ).getByRole("button", { name: /select/i })
    );
    fireEvent.click(screen.getByText("Medical"));
    fireEvent.click(
      within(disclaimerField).getByRole("button", { name: /select/i })
    );
    expect(screen.queryByText("Medical")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Switch guide" }));
    expect(screen.queryByText("Medical")).toBeNull();
    expect(screen.queryByText("Financial")).not.toBeNull();
  });

  it("does not show disclaimer editing for published revision fields", () => {
    render(
      <GuideDetails
        type="variant"
        guideContData={guide}
        onGuideChange={() => {}}
        subjects={[]}
        guides={[]}
        onSaveDraft={() => {}}
        showBaseFields={false}
      />
    );

    expect(screen.queryByText("Disclaimers")).toBeNull();
  });
});
