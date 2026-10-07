// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/dashboard/applications";

const { decideRoleApplication, toast, invalidate } = vi.hoisted(() => ({
  decideRoleApplication: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn() },
  invalidate: vi.fn(),
}));

const rows = [
  {
    id: "app-pending",
    user_id: "user-a",
    username: "alice",
    role: "verifier",
    status: "pending",
    statement: "I read closely.",
    date_created: "2026-10-01T00:00:00Z",
    date_decided: null,
    decided_by: null,
  },
  {
    id: "app-approved",
    user_id: "user-b",
    username: "bob",
    role: "moderator",
    status: "approved",
    statement: null,
    date_created: "2026-09-01T00:00:00Z",
    date_decided: "2026-09-02T00:00:00Z",
    decided_by: "root",
  },
];

vi.mock("sonner", () => ({ toast }));

// Keep loader data stable across renders; a new object clears page selection.
const page = { data: rows, total: rows.length };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => page,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
  useRouter: () => ({ invalidate }),
}));

vi.mock("@/lib/api/dashboard", () => ({
  decideRoleApplication,
  fetchRoleApplicationsTable: vi.fn(),
}));

const ApplicationsPage = Route.options.component as ComponentType;

describe("dashboard applications page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decideRoleApplication.mockResolvedValue(undefined);
    invalidate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("approves the selected pending application and reloads", async () => {
    render(<ApplicationsPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select alice" }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(decideRoleApplication).toHaveBeenCalledWith(
        "app-pending",
        "approved"
      )
    );
    expect(decideRoleApplication).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalledWith(
      "Approved the selected application(s); the role is granted."
    );
  });

  it("rejects the selected pending application", async () => {
    render(<ApplicationsPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select alice" }));
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(decideRoleApplication).toHaveBeenCalledWith(
        "app-pending",
        "rejected"
      )
    );
  });

  it("cannot select an application that is already decided", () => {
    render(<ApplicationsPage />);

    expect(screen.getByRole("checkbox", { name: "Select bob" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: /approve/i })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("selects only the pending rows with the header checkbox", () => {
    render(<ApplicationsPage />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all pending applications" })
    );

    const state = (name: string) =>
      screen.getByRole("checkbox", { name }).getAttribute("data-state");
    expect(state("Select alice")).toBe("checked");
    expect(state("Select bob")).toBe("unchecked");
  });

  it("shows who decided an application", () => {
    render(<ApplicationsPage />);

    expect(screen.getByText("by root")).toBeDefined();
  });
});
