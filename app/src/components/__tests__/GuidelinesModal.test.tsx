// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidelinesModal } from "@/components/modals/GuidelinesModal";

afterEach(cleanup);

describe("Quick Guidelines", () => {
  it("renders the callout reference as a table inside its list item", () => {
    render(<GuidelinesModal open onOpenChange={() => {}} />);

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent)
    ).toEqual(["Callout Type", "Meaning", "Use When"]);
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    for (const type of [
      "Info",
      "Note",
      "Tip",
      "Caution",
      "Warning",
      "Danger",
    ]) {
      expect(within(table).getByRole("cell", { name: type })).toBeDefined();
    }
    expect(table.closest("li")?.textContent).toContain("Callouts:");
  });

  it("doesn't preserve renderer whitespace between list blocks", () => {
    render(<GuidelinesModal open onOpenChange={() => {}} />);

    const callout = screen.getByText("Callouts:").closest("li")!;
    expect(callout.querySelector(":scope > p")).not.toBeNull();
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.classList.contains("whitespace-normal")).toBe(true);
    }
  });

  it("keeps the nested guidelines inside their parent list items", () => {
    render(<GuidelinesModal open onOpenChange={() => {}} />);

    const jargon = screen.getByText("Minimize jargon whenever possible.");
    expect(jargon.closest("ul")?.parentElement?.textContent).toContain(
      "Introducing New Concepts (Jargon)"
    );
    const formats = screen.getByText(/Allowed formats:/);
    expect(formats.closest("ul")?.parentElement?.textContent).toContain(
      "Images"
    );
  });

  it("lets the reader close the dialog", () => {
    const onOpenChange = vi.fn();
    render(<GuidelinesModal open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
