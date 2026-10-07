// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RoleApplication } from "@/lib/api/identity";
import {
  RoleApplicationsSection,
  roleStanding,
} from "@/components/settings/RoleApplicationsSection";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const application = (
  overrides: Partial<RoleApplication> = {}
): RoleApplication => ({
  id: crypto.randomUUID(),
  role: "verifier",
  status: "pending",
  statement: null,
  created_at: "2026-10-01T00:00:00Z",
  decided_at: null,
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe("roleStanding", () => {
  it("lets the newest application speak for a role", () => {
    const applications = [
      application({
        status: "pending",
        created_at: "2026-10-01T00:00:00Z",
      }),
      application({
        status: "rejected",
        created_at: "2026-09-01T00:00:00Z",
        decided_at: "2026-09-02T00:00:00Z",
      }),
    ];

    expect(roleStanding("verifier", [], applications)).toEqual({
      kind: "pending",
      since: "2026-10-01T00:00:00Z",
    });
  });

  it("reports a held role even with an old application still pending", () => {
    expect(roleStanding("verifier", ["verifier"], [application()])).toEqual({
      kind: "held",
    });
  });

  it("opens a fresh application after a rejection", () => {
    const rejected = application({
      status: "rejected",
      decided_at: "2026-10-02T00:00:00Z",
    });

    expect(roleStanding("verifier", [], [rejected])).toEqual({
      kind: "rejected",
      on: "2026-10-02T00:00:00Z",
    });
  });

  it("ignores applications for other roles", () => {
    expect(
      roleStanding("moderator", [], [application({ role: "verifier" })])
    ).toEqual({ kind: "open" });
  });
});

describe("RoleApplicationsSection", () => {
  it("shows held and pending roles without an apply button", () => {
    render(
      <RoleApplicationsSection
        roles={["verifier"]}
        applications={[application({ role: "moderator" })]}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText("Held")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^apply/i })).toBeNull();
  });

  it("sends the picked role with a trimmed statement", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <RoleApplicationsSection roles={[]} applications={[]} onApply={onApply} />
    );

    // Roles list in schema order: verifier, then moderator.
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[1]);
    fireEvent.change(screen.getByLabelText(/statement/i), {
      target: { value: "  I read closely and write up why.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith(
        "moderator",
        "I read closely and write up why."
      )
    );
  });

  it("sends no statement when the field is left empty", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <RoleApplicationsSection roles={[]} applications={[]} onApply={onApply} />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith("verifier", null));
  });

  it("offers to apply again after a rejection", () => {
    render(
      <RoleApplicationsSection
        roles={[]}
        applications={[
          application({
            status: "rejected",
            decided_at: "2026-10-02T00:00:00Z",
          }),
        ]}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Apply again" })).toBeDefined();
    expect(screen.getByText(/You can apply again/)).toBeDefined();
  });
});
