// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DownvoteSection } from "@/components/modals/DownvoteModal";
import { DownvoteModal } from "@/components/modals/DownvoteModal";

const sections: Array<DownvoteSection> = [
  { id: "setup", text: "Setup" },
  { id: "step-two", text: "Step two" },
];

// The combobox's command list measures and scrolls, which jsdom lacks.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderModal(
  existing: {
    reason: "unclear";
    note: string | null;
    section_ref?: string | null;
  } | null = null
) {
  const onSubmit = vi.fn();
  render(
    <DownvoteModal
      open
      onOpenChange={() => {}}
      submitting={false}
      existing={existing}
      sections={sections}
      onSubmit={onSubmit}
      onRemove={() => {}}
    />
  );
  return onSubmit;
}

function pickReason(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Select..." }));
  fireEvent.click(screen.getByText(label));
}

describe("DownvoteModal section pointer", () => {
  it("flags the whole guide unless a section is picked", () => {
    const onSubmit = renderModal();

    pickReason("Unclear");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith("unclear", "", null);
  });

  it("sends the anchor of the picked section", () => {
    const onSubmit = renderModal();

    pickReason("Missing Step");
    fireEvent.click(screen.getByRole("button", { name: "Whole guide" }));
    fireEvent.click(screen.getByText("Step two"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith("missing_step", "", "step-two");
  });

  it("keeps an existing pointer even when its heading is gone", () => {
    const onSubmit = renderModal({
      reason: "unclear",
      note: null,
      section_ref: "old-heading",
    });

    expect(screen.getByRole("button", { name: "old-heading" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith("unclear", "", "old-heading");
  });

  it("hides the section picker when the guide has no headings", () => {
    render(
      <DownvoteModal
        open
        onOpenChange={() => {}}
        submitting={false}
        existing={null}
        sections={[]}
        onSubmit={vi.fn()}
        onRemove={() => {}}
      />
    );

    expect(screen.queryByText("Which section?")).toBeNull();
  });
});
