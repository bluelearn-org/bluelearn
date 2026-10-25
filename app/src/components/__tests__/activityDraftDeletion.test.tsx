// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfilePageData } from "@/lib/profile";
import { ActivityTable } from "@/components/tables/ActivityTable";
import { deleteMyDrafts } from "@/lib/api/identity";
import { clearStoredDraftsForRevisions } from "@/lib/contributionStorage";

const { navigate, toastError } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/api/identity", () => ({ deleteMyDrafts: vi.fn() }));
vi.mock("@/lib/contributionStorage", () => ({
  clearStoredDraftsForRevisions: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));

type Row = ProfilePageData["activity"][number];
const guide: Row = {
  content_kind: "guide",
  is_variant: false,
  is_creation: true,
  title: "Guide draft",
  change_summary: null,
  created_at: "2026-10-15T12:00:00Z",
  status: "draft",
  target_slug: null,
  base_slug: null,
  review_case_id: null,
  revision_id: "31500000-0000-4000-8000-000000000001",
  subjects: [],
};
const objective: Row = {
  ...guide,
  content_kind: "objective",
  title: "Objective draft",
  revision_id: "31500000-0000-4000-8000-000000000002",
};
const submitted: Row = {
  ...guide,
  title: "Submitted guide",
  status: "submitted",
  revision_id: "31500000-0000-4000-8000-000000000003",
};
const props = {
  activity: [guide, objective, submitted],
  search: {},
  setFilters: vi.fn(),
  onPageChange: vi.fn(),
  canDeleteDrafts: true,
};
const select = (title: string) =>
  fireEvent.click(
    within(screen.getByRole("table")).getByRole("checkbox", {
      name: `Select draft: ${title}`,
    })
  );
const openConfirmation = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Delete drafts/ }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteMyDrafts).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("deleting contribution drafts", () => {
  it("offers selection only for drafts, on desktop and mobile", () => {
    render(<ActivityTable {...props} />);
    expect(
      screen.getByRole("heading", { name: "Contributions" })
    ).toBeDefined();
    expect(
      screen
        .getByRole("button", {
          name: "Delete drafts",
        })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      within(screen.getByRole("table")).getAllByRole("checkbox")
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("list")).getAllByRole("checkbox")
    ).toHaveLength(2);
    select(guide.title);
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen
        .getAllByRole("checkbox", { name: `Select draft: ${guide.title}` })
        .every((box) => box.getAttribute("aria-checked") === "true")
    ).toBe(true);
  });

  it("doesn't offer deletion on someone else's profile", () => {
    render(<ActivityTable {...props} canDeleteDrafts={false} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete drafts/ })).toBeNull();
  });

  it("lets the user cancel without deleting anything", () => {
    render(<ActivityTable {...props} />);
    select(guide.title);
    openConfirmation();
    expect(
      within(screen.getByRole("dialog")).getByText(guide.title)
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteMyDrafts).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deletes a mixed selection, clears local copies, and refreshes the profile", async () => {
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    render(<ActivityTable {...props} onDeleted={onDeleted} />);
    select(guide.title);
    select(objective.title);
    openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    const input = {
      guide_revision_ids: [guide.revision_id],
      objective_revision_ids: [objective.revision_id],
    };
    expect(deleteMyDrafts).toHaveBeenCalledWith(input);
    expect(clearStoredDraftsForRevisions).toHaveBeenCalledWith(input);
    expect(screen.queryByText(guide.title)).toBeNull();
    expect(screen.getAllByText(submitted.title)).toHaveLength(2);
  });

  it("keeps drafts and local copies when deletion fails, and allows retry", async () => {
    vi.mocked(deleteMyDrafts).mockRejectedValueOnce(
      new Error("No drafts were deleted.")
    );
    render(<ActivityTable {...props} />);
    select(guide.title);
    openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "No drafts were deleted."
      )
    );
    expect(clearStoredDraftsForRevisions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMyDrafts).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate requests while deletion is pending", async () => {
    let resolve!: () => void;
    vi.mocked(deleteMyDrafts).mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      })
    );
    render(<ActivityTable {...props} />);
    select(guide.title);
    openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    const pending = screen.getByRole("button", {
      name: "Deleting...",
    });
    expect(pending.hasAttribute("disabled")).toBe(true);
    fireEvent.click(pending);
    expect(deleteMyDrafts).toHaveBeenCalledOnce();
    resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("clears selection when filters change", () => {
    const { rerender } = render(<ActivityTable {...props} />);
    select(guide.title);
    rerender(<ActivityTable {...props} search={{ title: "Objective" }} />);
    expect(
      screen
        .getByRole("button", {
          name: "Delete drafts",
        })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("doesn't delete a selected row that is no longer a draft", () => {
    const { rerender } = render(<ActivityTable {...props} />);
    select(guide.title);
    rerender(
      <ActivityTable
        {...props}
        activity={[{ ...guide, status: "submitted" }]}
      />
    );
    expect(
      screen
        .getByRole("button", {
          name: "Delete drafts",
        })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("distinguishes a refresh failure from a failed deletion", async () => {
    render(
      <ActivityTable
        {...props}
        onDeleted={vi.fn().mockRejectedValue(new Error("offline"))}
      />
    );
    select(guide.title);
    openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Drafts were deleted")
      )
    );
    expect(screen.queryByText(guide.title)).toBeNull();
  });
});
