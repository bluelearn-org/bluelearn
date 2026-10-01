// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { SelectType } from "@/components/contribute/steps/SelectType";

const { authState } = vi.hoisted(() => ({
  authState: {
    roles: ["curator"] as Array<string>,
    currentProfile: { is_suspended: true },
  },
}));

vi.mock("@/lib/authContext", () => ({
  useAuth: () => authState,
}));

const Stepper = {
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Next: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
};

const renderSelectType = () =>
  render(<SelectType pickType={() => {}} type={null} Stepper={Stepper} />);

describe("SelectType suspension choices", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps Objective available while hiding Guide and Variant for a suspended curator", () => {
    authState.currentProfile.is_suspended = true;

    renderSelectType();

    expect(screen.getByRole("button", { name: "Objective" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guide" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Variant" })).toBeNull();
  });

  it("shows Guide and Variant for an active curator", () => {
    authState.currentProfile.is_suspended = false;

    renderSelectType();

    expect(screen.getByRole("button", { name: "Guide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Variant" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Objective" })).toBeTruthy();
  });
});
