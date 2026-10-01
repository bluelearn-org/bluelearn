// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userRoleSchema } from "@bluelearn/schemas";
import type { ComponentType } from "react";
import { Route } from "@/routes/dashboard/roles";

const { addRole, removeRole, toast, invalidate } = vi.hoisted(() => ({
  addRole: vi.fn(),
  removeRole: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn() },
  invalidate: vi.fn(),
}));

const users = [
  {
    id: "user-a",
    username: "alice",
    roles: ["verifier"],
    date_created: "2026-09-01T00:00:00Z",
    date_updated: "2026-09-01T00:00:00Z",
    status: "active",
  },
  {
    id: "user-b",
    username: "bob",
    roles: [],
    date_created: "2026-09-01T00:00:00Z",
    date_updated: "2026-09-01T00:00:00Z",
    status: "active",
  },
];

vi.mock("sonner", () => ({ toast }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({ data: users }),
  }),
  useRouter: () => ({ invalidate }),
}));

vi.mock("@/lib/api/dashboard", () => ({
  addRole,
  removeRole,
  toggleAFK: vi.fn(),
  fetchRoleTable: vi.fn(),
}));

const RolesPage = Route.options.component as ComponentType;

const pickRole = async (role: string) => {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Select role" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(await screen.findByRole("menuitemradio", { name: role }));
};

describe("dashboard roles page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addRole.mockResolvedValue(undefined);
    removeRole.mockResolvedValue(undefined);
    invalidate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("adds the role picked from the dropdown to every selected user", async () => {
    render(<RolesPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select alice" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select bob" }));
    await pickRole("moderator");
    fireEvent.click(screen.getByRole("button", { name: /add role/i }));

    await waitFor(() => expect(addRole).toHaveBeenCalledTimes(2));
    expect(addRole).toHaveBeenCalledWith("user-a", "moderator");
    expect(addRole).toHaveBeenCalledWith("user-b", "moderator");
    expect(toast.info).toHaveBeenCalledWith(
      'Successfully added role "moderator" to user(s)!'
    );
    expect(removeRole).not.toHaveBeenCalled();
  });

  it("removes the picked role and never sends the default one", async () => {
    render(<RolesPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select alice" }));
    await pickRole("curator");
    fireEvent.click(screen.getByRole("button", { name: /remove role/i }));

    await waitFor(() => expect(removeRole).toHaveBeenCalledTimes(1));
    expect(removeRole).toHaveBeenCalledWith("user-a", "curator");
    expect(removeRole).not.toHaveBeenCalledWith("user-a", "verifier");
    expect(addRole).not.toHaveBeenCalled();
  });

  it("falls back to verifier when nothing is picked", async () => {
    render(<RolesPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select bob" }));
    fireEvent.click(screen.getByRole("button", { name: /add role/i }));

    await waitFor(() => expect(addRole).toHaveBeenCalledTimes(1));
    expect(addRole).toHaveBeenCalledWith("user-b", "verifier");
  });

  it("offers exactly the roles the API accepts", async () => {
    render(<RolesPage />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Select role" }), {
      button: 0,
      ctrlKey: false,
    });
    const offered = (await screen.findAllByRole("menuitemradio")).map(
      (item) => item.textContent
    );

    expect(offered).toEqual([...userRoleSchema.options]);
  });
});
