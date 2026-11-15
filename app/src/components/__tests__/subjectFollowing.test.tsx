// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { SubjectFollowButton } from "@/components/SubjectFollowButton";

const mocks = vi.hoisted(() => {
  const auth: { user: { id: string } | null; loading: boolean } = {
    user: { id: "owner" },
    loading: false,
  };
  return {
    auth,
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    error: vi.fn(),
  };
});
vi.mock("@/lib/authContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/api/subjects", () => ({
  getSubjectFollow: mocks.get,
  setSubjectFollow: mocks.set,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: mocks.invalidate }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = { user: { id: "owner" }, loading: false };
  mocks.get.mockResolvedValue({ following: false });
  mocks.set.mockImplementation((_slug: string, following: boolean) =>
    Promise.resolve({ following })
  );
});
afterEach(cleanup);

const button = () =>
  render(<SubjectFollowButton slug="physics" name="Physics" />);

describe("subject following", () => {
  it("offers login to anonymous visitors without requesting private state", () => {
    mocks.auth.user = null;
    button();
    expect(
      screen.getByRole("link", { name: "Follow Physics" }).getAttribute("href")
    ).toBe("/login");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("waits for authentication and initial follow state", () => {
    mocks.auth.loading = true;
    const view = button();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.auth.loading = false;
    mocks.get.mockReturnValue(new Promise(() => {}));
    view.rerender(<SubjectFollowButton slug="physics" name="Physics" />);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("follows, prevents duplicate actions, and unfollows", async () => {
    let finish!: (value: { following: boolean }) => void;
    mocks.set.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    button();
    const follow = await screen.findByRole("button", {
      name: "Follow Physics",
    });
    await waitFor(() => expect(follow.hasAttribute("disabled")).toBe(false));
    expect(follow.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(follow);
    fireEvent.click(follow);
    expect(follow.hasAttribute("disabled")).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith("physics", true);
    await act(async () => {
      finish({ following: true });
      await Promise.resolve();
    });
    const unfollow = await screen.findByRole("button", {
      name: "Unfollow Physics",
    });
    expect(unfollow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(unfollow);
    await waitFor(() =>
      expect(mocks.set).toHaveBeenLastCalledWith("physics", false)
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Follow Physics" })
          .getAttribute("aria-pressed")
      ).toBe("false")
    );
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
  });

  it("loads persisted state on remount", async () => {
    mocks.get.mockResolvedValue({ following: true });
    const view = button();
    expect(
      await screen.findByRole("button", { name: "Unfollow Physics" })
    ).toBeDefined();
    view.unmount();
    button();
    expect(
      await screen.findByRole("button", { name: "Unfollow Physics" })
    ).toBeDefined();
  });

  it("keeps the last confirmed state after a mutation failure", async () => {
    mocks.set.mockRejectedValue(new Error("Database unavailable"));
    button();
    const follow = await screen.findByRole("button", {
      name: "Follow Physics",
    });
    await waitFor(() => expect(follow.hasAttribute("disabled")).toBe(false));
    fireEvent.click(follow);
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Could not update followed subject. Try again."
      )
    );
    expect(follow.getAttribute("aria-pressed")).toBe("false");
    expect(follow.hasAttribute("disabled")).toBe(false);
  });

  it("offers retry when initial state fails", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Offline"));
    button();
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry loading follow state" })
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", {
            name: "Follow Physics",
          })
          .hasAttribute("disabled")
      ).toBe(false)
    );
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("does not carry private state across account or subject changes", async () => {
    mocks.get.mockResolvedValueOnce({ following: true });
    const view = button();
    await screen.findByRole("button", { name: "Unfollow Physics" });
    mocks.auth.user = { id: "other" };
    view.rerender(<SubjectFollowButton slug="physics" name="Physics" />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Follow Physics" })
          .getAttribute("aria-pressed")
      ).toBe("false")
    );
    view.rerender(<SubjectFollowButton slug="math" name="Math" />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Follow Math" })
          .getAttribute("aria-pressed")
      ).toBe("false")
    );
    expect(mocks.get).toHaveBeenLastCalledWith(
      "math",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
