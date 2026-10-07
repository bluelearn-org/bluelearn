// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FloorGuide } from "@/components/dashboard/SubjectFloorEditor";
import { SubjectFloorEditor } from "@/components/dashboard/SubjectFloorEditor";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const arithmetic: FloorGuide = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "arithmetic",
  title: "Arithmetic",
};
const algebra: FloorGuide = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "algebra",
  title: "Algebra",
};
const mechanics: FloorGuide = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "mechanics",
  title: "Mechanics",
};

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

function renderEditor(floor: Array<FloorGuide>) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <SubjectFloorEditor
      subjectName="Physics"
      floor={floor}
      guides={[arithmetic, algebra, mechanics]}
      onSave={onSave}
    />
  );
  return onSave;
}

describe("SubjectFloorEditor", () => {
  it("saves nothing until the floor changes", () => {
    renderEditor([arithmetic]);

    expect(screen.getByText("Arithmetic")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save floor" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("removes a guide and saves the remaining ids", async () => {
    const onSave = renderEditor([arithmetic, algebra]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Algebra from the floor" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save floor" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([arithmetic.id]));
  });

  it("adds a guide picked from the combobox", async () => {
    const onSave = renderEditor([arithmetic]);

    fireEvent.click(screen.getByRole("button", { name: "Select..." }));
    fireEvent.click(screen.getByText("Algebra"));
    fireEvent.click(screen.getByRole("button", { name: "Save floor" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([arithmetic.id, algebra.id])
    );
  });

  it("offers only guides that are not already in the floor", () => {
    renderEditor([arithmetic, algebra]);

    fireEvent.click(screen.getByRole("button", { name: "Select..." }));

    expect(screen.getByText("Mechanics")).toBeDefined();
    expect(screen.queryAllByText("Arithmetic")).toHaveLength(1);
  });

  it("resets to the stored floor", () => {
    renderEditor([arithmetic]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Arithmetic from the floor" })
    );
    expect(screen.getByText(/No floor yet/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Arithmetic")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save floor" })).toHaveProperty(
      "disabled",
      true
    );
  });
});
