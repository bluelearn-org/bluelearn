// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VariantContribution } from "@/types/contributions";

import { VariantDetails } from "@/components/contribute/steps/variant/VariantDetails";

const { getGuide } = vi.hoisted(() => ({ getGuide: vi.fn() }));

vi.mock("@/lib/api/guides", () => ({ getGuide }));

const guides = [
  { slug: "sql-joins", title: "SQL Joins", summary: null, is_official: false },
  {
    slug: "binary-search",
    title: "Binary Search",
    summary: null,
    is_official: false,
  },
] as unknown as Parameters<typeof VariantDetails>[0]["guides"];

const emptyVariant = (): VariantContribution => ({
  type: "theoretical",
  title: "",
  summary: "",
  baseGuide: "",
  subjects: [],
  newSubjects: [],
  body: "",
  disclaimers: [],
});

function Harness() {
  const [data, setData] = useState(emptyVariant);

  return (
    <VariantDetails
      variantContData={data}
      onVariantChange={(update) => setData((prev) => ({ ...prev, ...update }))}
      guides={guides}
      subjects={[]}
    />
  );
}

const field = (label: string) =>
  screen.getByText(label).closest("div")!.parentElement!;

const pickBaseGuide = async (title: string) => {
  // Its only button is the trigger, which shows the current pick once set.
  fireEvent.click(within(field("Base Guide")).getByRole("button"));
  await act(() => {
    fireEvent.click(screen.getByText(title));
  });
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("VariantDetails disclaimers", () => {
  let scrollDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    // The combobox popover needs these browser APIs, which jsdom lacks.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    scrollDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollIntoView"
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    getGuide.mockImplementation((slug: string) =>
      Promise.resolve({
        slug,
        disclaimers: slug === "sql-joins" ? ["medical"] : [],
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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

  it("prefills the base guide's disclaimers and lets the author edit them", async () => {
    render(<Harness />);

    await pickBaseGuide("SQL Joins");
    expect(getGuide).toHaveBeenCalledWith("sql-joins");

    const disclaimers = field("Disclaimers");
    expect(within(disclaimers).queryByText("Medical")).not.toBeNull();

    fireEvent.click(
      within(disclaimers).getByRole("button", { name: /select/i })
    );
    fireEvent.click(screen.getByText("Legal"));
    expect(within(disclaimers).queryByText("Legal")).not.toBeNull();

    fireEvent.click(
      within(disclaimers).getByRole("button", { name: "Remove Medical" })
    );
    expect(within(disclaimers).queryByText("Medical")).toBeNull();
    expect(within(disclaimers).queryByText("Legal")).not.toBeNull();
  });

  it("keeps the latest base guide's disclaimers when lookups resolve out of order", async () => {
    const slow = deferred<{ slug: string; disclaimers: Array<string> }>();
    getGuide.mockImplementation((slug: string) =>
      slug === "sql-joins"
        ? slow.promise
        : Promise.resolve({ slug, disclaimers: [] })
    );

    render(<Harness />);

    await pickBaseGuide("SQL Joins");
    await pickBaseGuide("Binary Search");

    await act(() => {
      slow.resolve({ slug: "sql-joins", disclaimers: ["medical"] });
    });

    expect(within(field("Disclaimers")).queryByText("Medical")).toBeNull();
  });
});
