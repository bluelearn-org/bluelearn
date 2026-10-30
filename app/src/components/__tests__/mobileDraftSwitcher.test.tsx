import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileDraftSwitcher } from "@/components/sidebar/MobileDraftSwitcher";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const guides = [
  { localDraftId: "a", title: "Intro to Limits" },
  { localDraftId: "b", title: "" },
];

const renderSwitcher = (onSelectGuide = vi.fn()) =>
  render(
    <TooltipProvider>
      <MobileDraftSwitcher
        guides={guides}
        activeGuideId="b"
        onSelectGuide={onSelectGuide}
        onAddGuide={() => {}}
        onDeleteGuide={() => {}}
      />
    </TooltipProvider>
  );

describe("MobileDraftSwitcher", () => {
  it("shows the active draft position and a fallback title", () => {
    renderSwitcher();

    const trigger = screen.getByRole("button", {
      name: "Drafts: guide 2 of 2, Guide 2",
    });
    expect(trigger.textContent).toContain("2 / 2");
  });

  it("selects a draft from the sheet and closes it", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const onSelectGuide = vi.fn();
    renderSwitcher(onSelectGuide);

    fireEvent.click(screen.getByRole("button", { name: /^Drafts:/ }));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Intro to Limits/ }));

    expect(onSelectGuide).toHaveBeenCalledWith("a");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
