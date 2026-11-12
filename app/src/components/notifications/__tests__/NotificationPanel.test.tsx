// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Notification, NotificationCategory } from "@bluelearn/schemas";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

const { listNotifications, markNotificationRead, markAllNotificationsRead } =
  vi.hoisted(() => ({
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  }));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@/lib/api/notifications", () => ({
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children: ReactNode;
    to: string;
    onClick?: () => void;
  }) => (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

type ListQuery = {
  page: number;
  limit: number;
  category?: NotificationCategory;
};

const refreshUnread = vi.fn();
const closePanel = vi.fn();

const row = (overrides: Partial<Notification>): Notification => ({
  id: crypto.randomUUID(),
  type: "guide_review_decision",
  category: "guide_statuses",
  actor: null,
  count: 1,
  data: { outcome: "approved", title: "How to speed", case_id: "c1" },
  occurred_at: "2026-07-27T10:00:00Z",
  read_at: null,
  ...overrides,
});

const titled = (title: string) =>
  row({ data: { outcome: "approved", title, case_id: "c1" } });

const vote = (type: "guide_upvotes" | "guide_downvotes") =>
  row({
    type,
    category: "community_engagement",
    count: 2,
    data: {
      title: "Sorting",
      base_slug: "sorting",
      variant_slug: "alternative",
    },
  });

const envelope = (
  notifications: Array<Notification>,
  total = notifications.length
) => ({ notifications, total });

const unreadMarkers = () =>
  within(screen.getByRole("list")).queryAllByText("Unread");

const pickView = async (label: string) => {
  fireEvent.pointerDown(screen.getByRole("button", { name: "All" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
};

// Holds the unread count the way NotificationBell does, so the test reads the
// count from the panel header.
function Harness({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  return (
    <NotificationPanel
      unread={unread}
      onUnreadChange={setUnread}
      onRefreshUnread={refreshUnread}
      onNavigate={closePanel}
    />
  );
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markNotificationRead.mockResolvedValue(undefined);
    markAllNotificationsRead.mockResolvedValue(undefined);
    refreshUnread.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("marks a row read when it is opened", async () => {
    listNotifications.mockResolvedValue(envelope([row({})]));
    render(<Harness initialUnread={2} />);
    const opened = await screen.findByRole("button", {
      name: /guide.*approved/i,
    });
    expect(unreadMarkers()).toHaveLength(1);

    fireEvent.click(opened);

    expect(await screen.findByText(/\b1\s+unread\b/i)).toBeTruthy();
    expect(unreadMarkers()).toHaveLength(0);
  });

  it("does not lower the count when a read row is opened", async () => {
    listNotifications.mockResolvedValue(
      envelope([row({ read_at: "2026-07-28T10:00:00Z" })])
    );
    render(<Harness initialUnread={2} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /guide.*approved/i })
    );

    await waitFor(() =>
      expect(screen.getByText(/\b2\s+unread\b/i)).toBeTruthy()
    );
  });

  it("clears every unread marker with Mark all as read", async () => {
    listNotifications.mockResolvedValue(
      envelope([row({}), row({ data: { outcome: "rejected" } })])
    );
    render(<Harness initialUnread={2} />);
    await waitFor(() => expect(unreadMarkers()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: /mark.*all.*read/i }));

    await waitFor(() => expect(unreadMarkers()).toHaveLength(0));
    expect(refreshUnread).toHaveBeenCalledTimes(1);
  });

  it("keeps the unread markers when Mark all as read fails", async () => {
    markAllNotificationsRead.mockRejectedValue(new Error("500"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    listNotifications.mockResolvedValue(
      envelope([row({}), row({ data: { outcome: "rejected" } })])
    );
    render(<Harness initialUnread={2} />);
    await waitFor(() => expect(unreadMarkers()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: /mark.*all.*read/i }));

    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(unreadMarkers()).toHaveLength(2);
    expect(refreshUnread).not.toHaveBeenCalled();
  });

  it.each([
    { view: "All", category: undefined },
    { view: "Community engagement", category: "community_engagement" },
  ])(
    "scopes the list and Mark all as read to the $view view",
    async ({ view, category }) => {
      listNotifications.mockResolvedValue(envelope([row({})]));
      render(<Harness initialUnread={1} />);
      await screen.findByRole("button", { name: /guide.*approved/i });

      await pickView(view);

      await waitFor(() =>
        expect(listNotifications.mock.lastCall?.[0].category).toBe(category)
      );
      fireEvent.click(
        await screen.findByRole("button", { name: /mark.*all.*read/i })
      );
      await waitFor(() =>
        expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
      );
      expect(markAllNotificationsRead).toHaveBeenCalledWith(category);
    }
  );

  it("appends older rows once each and stops at the total", async () => {
    const newest = titled("Newest");
    const shared = titled("Shared");
    const oldest = titled("Oldest");
    listNotifications.mockImplementation(({ page, limit }: ListQuery) =>
      Promise.resolve(
        envelope(page === 1 ? [newest, shared] : [shared, oldest], limit + 1)
      )
    );
    render(<Harness initialUnread={0} />);

    fireEvent.click(await screen.findByRole("button", { name: /show older/i }));

    expect(await screen.findByText(/"Oldest"/)).toBeTruthy();
    expect(screen.getAllByText(/"Shared"/)).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /show older/i })).toBeNull();
  });

  it("drops an older page that lands after the view changes", async () => {
    let landOlder: (result: unknown) => void = () => {};
    listNotifications.mockImplementation(
      (
        { page, limit, category }: ListQuery,
        { signal }: { signal?: AbortSignal }
      ) => {
        if (category) return Promise.resolve(envelope([titled("Engagement")]));
        if (page === 1) {
          return Promise.resolve(envelope([titled("First")], limit + 1));
        }

        // Rejects on abort the way fetch does.
        return new Promise((resolve, reject) => {
          landOlder = resolve;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        });
      }
    );
    render(<Harness initialUnread={0} />);
    fireEvent.click(await screen.findByRole("button", { name: /show older/i }));

    await pickView("Community engagement");
    expect(await screen.findByText(/"Engagement"/)).toBeTruthy();
    act(() => landOlder(envelope([titled("Stale")])));

    expect(screen.queryByText(/"Stale"/)).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the empty state when there is nothing to show", async () => {
    listNotifications.mockResolvedValue(envelope([]));
    render(<Harness initialUnread={0} />);

    expect(await screen.findByText(/no.*notifications/i)).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    listNotifications
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(envelope([row({})]));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness initialUnread={1} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /try again|retry/i })
    );

    expect(
      await screen.findByRole("button", { name: /guide.*approved/i })
    ).toBeTruthy();
  });

  it("opens a downvote row on the notifications page at that row", async () => {
    const downvote = vote("guide_downvotes");
    listNotifications.mockResolvedValue(envelope([downvote]));
    render(<Harness initialUnread={1} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /click to see why/i })
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/profile/notifications",
        hash: `notification-${downvote.id}`,
      })
    );
    expect(markNotificationRead).toHaveBeenCalledWith(downvote.id);
    expect(unreadMarkers()).toHaveLength(0);
    expect(closePanel).toHaveBeenCalled();
  });

  it("keeps the guide page for an upvote row", async () => {
    listNotifications.mockResolvedValue(envelope([vote("guide_upvotes")]));
    render(<Harness initialUnread={1} />);

    fireEvent.click(await screen.findByRole("button", { name: /upvoted/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/guides/$slug/$variantSlug",
        params: { slug: "sorting", variantSlug: "alternative" },
      })
    );
  });

  it("links every notification from the footer and closes the panel", async () => {
    listNotifications.mockResolvedValue(envelope([row({})]));
    render(<Harness initialUnread={0} />);
    const viewAll = await screen.findByRole("link", { name: /view all/i });

    fireEvent.click(viewAll);

    expect(viewAll.getAttribute("href")).toBe("/profile/notifications");
    expect(closePanel).toHaveBeenCalledTimes(1);
  });
});
