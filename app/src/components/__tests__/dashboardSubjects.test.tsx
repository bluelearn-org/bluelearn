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
import type { DashboardSubject } from "@bluelearn/schemas";
import { Route } from "@/routes/dashboard/subjects";
import { ManageSubjectsDialog } from "@/components/subjects/ManageSubjectsDialog";
import {
  DashboardSidebar,
  DashboardTabs,
} from "@/components/sidebar/DashboardSidebar";

const state = vi.hoisted(() => ({
  manage: vi.fn(),
  invalidate: vi.fn(),
  fetch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  roles: [] as Array<string>,
}));
const subjects: Array<DashboardSubject> = [
  {
    id: "52100000-0000-4000-8000-000000000001",
    name: "Mathematics",
    summary: "Numbers and patterns",
    slug: "mathematics",
    status: "published",
    date_created: "2026-10-23T00:00:00Z",
  },
  {
    id: "52100000-0000-4000-8000-000000000002",
    name: "Maths",
    summary: null,
    slug: "maths",
    status: "published",
    date_created: "2026-10-23T00:00:00Z",
  },
  {
    id: "52100000-0000-4000-8000-000000000003",
    name: "Math draft",
    summary: null,
    slug: null,
    status: "draft",
    date_created: "2026-10-23T00:00:00Z",
  },
];
const page = { data: subjects, total: subjects.length };
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => page,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
  useRouter: () => ({ invalidate: state.invalidate }),
  useRouterState: () => "/dashboard/subjects",
  notFound: vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/authContext", () => ({
  useAuth: () => ({ roles: state.roles }),
}));
vi.mock("@/lib/api/dashboard", () => ({
  manageSubjects: state.manage,
  fetchSubjectsTable: state.fetch,
}));
vi.mock("sonner", () => ({ toast: state.toast }));
const SubjectsPage = Route.options.component as ComponentType;
beforeEach(() => {
  vi.clearAllMocks();
  state.roles = [];
  state.manage.mockResolvedValue(undefined);
  state.invalidate.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("dashboard subjects", () => {
  it("requires one subject for editing and multiple subjects for merging", () => {
    render(<SubjectsPage />);
    expect(
      screen
        .getByRole("button", { name: "Edit subject" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Merge subjects" })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Mathematics" })
    );
    expect(
      screen
        .getByRole("button", { name: "Edit subject" })
        .hasAttribute("disabled")
    ).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Maths" }));
    expect(
      screen
        .getByRole("button", { name: "Edit subject" })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Merge subjects (2)" }));
    expect(
      screen.getByRole("dialog", { name: "Merge 2 subjects" })
    ).toBeDefined();
    expect(state.manage).not.toHaveBeenCalled();
  });

  it("selects and clears the current page without offering a destructive delete action", () => {
    render(<SubjectsPage />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all subjects on this page" })
    );
    expect(
      screen
        .getByRole("button", { name: "Merge subjects (3)" })
        .hasAttribute("disabled")
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all subjects on this page" })
    );
    expect(
      screen
        .getByRole("button", { name: "Merge subjects" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("edits name and summary and refreshes only after saving", async () => {
    render(<SubjectsPage />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Mathematics" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit subject" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Pure mathematics" },
    });
    fireEvent.change(screen.getByLabelText("Summary"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(state.invalidate).toHaveBeenCalledOnce());
    expect(state.manage).toHaveBeenCalledWith({
      subject_ids: [subjects[0].id],
      target_id: subjects[0].id,
      name: "Pure mathematics",
      summary: "",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("allows changing the retained subject and sends one atomic merge", async () => {
    const close = vi.fn();
    const saved = vi.fn().mockResolvedValue(undefined);
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={close}
        onSaved={saved}
      />
    );
    const target = screen.getByLabelText("Subject to keep");
    expect(screen.queryByRole("option", { name: "Math draft" })).toBeNull();
    fireEvent.change(target, { target: { value: subjects[1].id } });
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Maths");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Mathematical sciences" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(state.manage).toHaveBeenCalledOnce();
    expect(state.manage).toHaveBeenCalledWith({
      subject_ids: subjects.map(({ id }) => id),
      target_id: subjects[1].id,
      name: "Mathematical sciences",
      summary: "",
    });
    expect(saved).toHaveBeenCalledOnce();
  });

  it("cancels without changing subjects", () => {
    const close = vi.fn();
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={close}
        onSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(state.manage).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only name without sending a request", () => {
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(state.manage).not.toHaveBeenCalled();
  });

  it("keeps edits after a failure and supports retry", async () => {
    state.manage.mockRejectedValueOnce(
      new Error("Selection changed. Refresh and try again.")
    );
    const saved = vi.fn().mockResolvedValue(undefined);
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={vi.fn()}
        onSaved={saved}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Selection changed. Refresh and try again."
    );
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  });

  it("disables resubmission and cancellation while a merge is pending", async () => {
    let finish!: () => void;
    state.manage.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const close = vi.fn();
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={close}
        onSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(
      screen.getByRole("button", { name: "Saving..." }).hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Saving..." }));
    expect(state.manage).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("doesn't report a successful merge as failed when refreshing the table fails", async () => {
    render(
      <ManageSubjectsDialog
        subjects={subjects}
        onClose={vi.fn()}
        onSaved={vi.fn().mockRejectedValue(new Error("offline"))}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    await waitFor(() =>
      expect(state.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Subjects were saved")
      )
    );
  });

  it.each(["admin", "lead-verifier", "verifier"])(
    "shows desktop and mobile subject navigation only to managers: %s",
    (role) => {
      state.roles = [role];
      render(
        <>
          <DashboardSidebar />
          <DashboardTabs />
        </>
      );
      expect(screen.queryAllByRole("link", { name: "Subjects" })).toHaveLength(
        role === "verifier" ? 0 : 2
      );
    }
  );
});
