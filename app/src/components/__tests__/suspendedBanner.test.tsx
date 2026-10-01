// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuspendedBanner } from "@/components/SuspendedBanner";

const { suspensionStatus } = vi.hoisted<{
  suspensionStatus: {
    value: "active" | "pending" | "suspended" | "unavailable";
  };
}>(() => ({
  suspensionStatus: { value: "active" },
}));

vi.mock("@/lib/authContext", () => ({
  useSuspensionStatus: () => suspensionStatus.value,
}));

describe("SuspendedBanner", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the exact suspension warning for suspended users", () => {
    suspensionStatus.value = "suspended";

    render(<SuspendedBanner />);

    expect(
      screen.getByText(
        "Warning! Your account has been suspended, you may not submit any guides, for more info contact info@bluelearn.org"
      )
    ).toBeTruthy();
  });

  it.each(["active", "pending", "unavailable"] as const)(
    "does not render for %s users",
    (status) => {
      suspensionStatus.value = status;

      render(<SuspendedBanner />);

      expect(screen.queryByText(/Your account has been suspended/)).toBeNull();
    }
  );
});
