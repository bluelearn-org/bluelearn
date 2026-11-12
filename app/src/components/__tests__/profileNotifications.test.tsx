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
import type { ComponentType, ReactNode } from "react";
import type { Notification } from "@bluelearn/schemas";
import { Route } from "@/routes/profile.notifications";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  location,
  navigate,
  scrollIntoView,
} = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  location: { hash: "" },
  navigate: vi.fn(),
  scrollIntoView: vi.fn(),
}));

vi.mock("@/lib/api/notifications", () => ({
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
}));

vi.mock("@/lib/authContext", () => ({
  useAuth: () => ({ currentProfile: { username: "seeduser" } }),
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { username: string };
  }) => (
    <a href={params ? to.replace("$username", params.username) : to}>
      {children}
    </a>
  ),
  useLocation: ({ select }: { select: (value: { hash: string }) => string }) =>
    select(location),
  useMatchRoute: () => () => false,
  useNavigate: () => navigate,
}));

const NotificationsPage = Route.options.component as ComponentType;

const downvote = (overrides: Partial<Notification> = {}): Notification => ({
  id: crypto.randomUUID(),
  type: "guide_downvotes",
  category: "community_engagement",
  actor: null,
  count: 2,
  data: {
    title: "Sorting",
    base_slug: "sorting",
    variant_slug: "alternative",
    feedback: [
      { reason: "missing_step", note: "Step 3 skips setup." },
      { reason: "outdated", note: null },
    ],
  },
  occurred_at: "2026-07-27T10:00:00Z",
  read_at: null,
  ...overrides,
});

const envelope = (
  notifications: Array<Notification>,
  total = notifications.length
) => ({ notifications, total });

const anchor = (item: Notification) =>
  document.getElementById(`notification-${item.id}`);

// The bell sits in the navbar above the page, so these render both.
const renderWithBell = () =>
  render(
    <>
      <NotificationBell />
      <NotificationsPage />
    </>
  );

describe("profile notifications page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    location.hash = "";
    // jsdom has no layout, so scrolling is recorded instead.
    Element.prototype.scrollIntoView = scrollIntoView;
    markNotificationRead.mockResolvedValue(undefined);
    markAllNotificationsRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists every reason with its note, or the reason alone, newest first", async () => {
    const downvoted = downvote();
    const upvoted = downvote({
      type: "guide_upvotes",
      data: { title: "Sorting", base_slug: "sorting", variant_slug: "x" },
    });
    listNotifications.mockResolvedValue(envelope([downvoted, upvoted]));
    render(<NotificationsPage />);

    const reasons = await screen.findByRole("list", {
      name: /downvote reasons/i,
    });

    expect(anchor(downvoted)?.contains(reasons)).toBe(true);
    expect(
      within(reasons)
        .getAllByRole("listitem")
        .map((entry) => Array.from(entry.children, (line) => line.textContent))
    ).toEqual([["Missing Step", "Step 3 skips setup."], ["Outdated"]]);
    expect(anchor(upvoted)).not.toBeNull();
    expect(
      screen.getAllByRole("list", { name: /downvote reasons/i })
    ).toHaveLength(1);
  });

  it("opens the guide from a downvote row and marks it read, without the bell's hint", async () => {
    const downvoted = downvote();
    listNotifications.mockResolvedValue(envelope([downvoted]));
    render(<NotificationsPage />);

    const opened = await screen.findByRole("button", {
      name: /2 downvotes on "Sorting"/i,
    });
    expect(opened.textContent).not.toMatch(/click to see why/i);
    fireEvent.click(opened);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/guides/$slug/$variantSlug",
        params: { slug: "sorting", variantSlug: "alternative" },
      })
    );
    expect(markNotificationRead).toHaveBeenCalledWith(downvoted.id);
  });

  it("marks a downvote row read without leaving when its guide is unknown", async () => {
    const downvoted = downvote({ data: { title: "Sorting" } });
    listNotifications.mockResolvedValue(envelope([downvoted]));
    render(<NotificationsPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: /2 downvotes on "Sorting"/i })
    );

    await waitFor(() =>
      expect(markNotificationRead).toHaveBeenCalledWith(downvoted.id)
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("brings in older rows until the linked row shows, then scrolls to it and marks it read", async () => {
    const linked = downvote();
    const newer = downvote({ read_at: "2026-07-28T10:00:00Z" });
    location.hash = `notification-${linked.id}`;
    listNotifications.mockImplementation(
      ({ page, limit }: { page: number; limit: number }) =>
        Promise.resolve(envelope([page === 1 ? newer : linked], limit + 1))
    );
    getUnreadNotificationCount.mockResolvedValueOnce(1).mockResolvedValue(0);
    renderWithBell();

    await waitFor(() =>
      expect(markNotificationRead).toHaveBeenCalledWith(linked.id)
    );
    expect(scrollIntoView.mock.contexts).toEqual([anchor(linked)]);
    await waitFor(() =>
      expect(getUnreadNotificationCount).toHaveBeenCalledTimes(2)
    );
    expect(
      await screen.findByRole("button", { name: "Notifications" })
    ).toBeTruthy();
  });

  it("scrolls to a linked row that is already read without marking it again", async () => {
    const linked = downvote({ read_at: "2026-07-28T10:00:00Z" });
    location.hash = `notification-${linked.id}`;
    listNotifications.mockResolvedValue(envelope([linked]));
    render(<NotificationsPage />);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts).toEqual([anchor(linked)]);
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("clears the rows and the bell's count with Mark all as read", async () => {
    getUnreadNotificationCount.mockResolvedValueOnce(2).mockResolvedValue(0);
    listNotifications.mockResolvedValue(envelope([downvote(), downvote()]));
    renderWithBell();
    await screen.findByRole("button", { name: "Notifications, 2 unread" });

    fireEvent.click(
      await screen.findByRole("button", { name: /mark all as read/i })
    );

    expect(
      await screen.findByRole("button", { name: "Notifications" })
    ).toBeTruthy();
    expect(screen.queryAllByText("Unread")).toHaveLength(0);
    expect(markAllNotificationsRead).toHaveBeenCalledWith(undefined);
  });

  it("keeps the rows and the bell's count when Mark all as read fails", async () => {
    markAllNotificationsRead.mockRejectedValue(new Error("500"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    getUnreadNotificationCount.mockResolvedValue(2);
    listNotifications.mockResolvedValue(envelope([downvote(), downvote()]));
    renderWithBell();
    await screen.findByRole("button", { name: "Notifications, 2 unread" });

    fireEvent.click(
      await screen.findByRole("button", { name: /mark all as read/i })
    );

    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Unread")).toHaveLength(2);
  });
});
