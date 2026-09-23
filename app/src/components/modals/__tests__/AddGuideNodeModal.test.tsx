// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { GuideListItem } from "@bluelearn/schemas";

import type { ObjectiveGraphNode } from "@/types/contributions";
import { AddGuideNodeModal } from "@/components/modals/AddGuideNodeModal";

const guide = (id: string, title: string) =>
  ({ id, slug: title.toLowerCase(), title, summary: null }) as GuideListItem;

const GUIDES = [guide("base-loops", "Loops"), guide("base-rec", "Recursion")];

function renderModal(existingGuideBaseIds: Array<string> = []) {
  const added: { nodes: Array<ObjectiveGraphNode> | null } = { nodes: null };

  render(
    <AddGuideNodeModal
      open
      onOpenChange={() => {}}
      guides={GUIDES}
      existingGuideBaseIds={existingGuideBaseIds}
      onAdd={(nodes) => {
        added.nodes = nodes;
      }}
    />
  );

  return { dialog: screen.getByRole("dialog"), added };
}

// radix tabs switch on mousedown
const openTab = (dialog: HTMLElement, name: RegExp) =>
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name }), {
    button: 0,
  });

// hidden: an open popover marks the dialog aria-hidden
const addButton = (dialog: HTMLElement) =>
  within(dialog).getByRole<HTMLButtonElement>("button", {
    name: /^add$/i,
    hidden: true,
  });

// jsdom has neither; cmdk calls both
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView = () => {};
});

describe("AddGuideNodeModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds one guide request with the typed title and summary", () => {
    const { dialog, added } = renderModal();
    openTab(dialog, /request a guide/i);

    fireEvent.change(within(dialog).getByLabelText(/title/i), {
      target: { value: "  Call stacks " },
    });
    fireEvent.change(within(dialog).getByLabelText(/summary/i), {
      target: { value: "What a frame holds" },
    });
    fireEvent.click(addButton(dialog));

    expect(added.nodes).toEqual([
      {
        id: expect.any(String),
        type: "guide_request",
        title: "Call stacks",
        summary: "What a frame holds",
      },
    ]);
  });

  it("keeps Add disabled while the request title is empty", () => {
    const { dialog, added } = renderModal();
    openTab(dialog, /request a guide/i);

    fireEvent.change(within(dialog).getByLabelText(/title/i), {
      target: { value: "   " },
    });
    fireEvent.change(within(dialog).getByLabelText(/summary/i), {
      target: { value: "What a frame holds" },
    });

    expect(addButton(dialog).disabled).toBe(true);
    fireEvent.click(addButton(dialog));
    expect(added.nodes).toBeNull();
  });

  it("offers only guides not already on the canvas, and adds the chosen one", async () => {
    const { dialog, added } = renderModal(["base-rec"]);

    fireEvent.click(within(dialog).getByRole("button", { name: /select/i }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Loops"]);

    fireEvent.click(options[0]);
    fireEvent.click(addButton(dialog));

    expect(added.nodes).toEqual([
      {
        id: expect.any(String),
        type: "guide",
        guideBaseId: "base-loops",
        guideSlug: "loops",
        title: "Loops",
      },
    ]);
  });

  it("adds the chosen guide as a target from the target tab, never one already on the canvas", async () => {
    const { dialog, added } = renderModal(["base-rec"]);
    openTab(dialog, /target guide/i);

    fireEvent.click(within(dialog).getByRole("button", { name: /select/i }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Loops"]);

    fireEvent.click(options[0]);
    fireEvent.click(addButton(dialog));

    expect(added.nodes).toEqual([
      {
        id: expect.any(String),
        type: "target",
        guideBaseId: "base-loops",
        guideSlug: "loops",
        title: "Loops",
      },
    ]);
  });

  it("starts the Target tab with its own empty selection after guides were picked in Existing", async () => {
    const { dialog } = renderModal();

    fireEvent.click(within(dialog).getByRole("button", { name: /select/i }));
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    openTab(dialog, /target guide/i);

    expect(within(dialog).getByText(/a target is a guide/i)).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", {
        name: /remove loops/i,
        hidden: true,
      })
    ).toBeNull();
    expect(addButton(dialog).disabled).toBe(true);
  });

  it("offers every guide while none is on the canvas", async () => {
    const { dialog } = renderModal();

    fireEvent.click(within(dialog).getByRole("button", { name: /select/i }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Loops", "Recursion"]);
  });
});
