// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Notification } from "@bluelearn/schemas";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

const { listNotifications, markNotificationRead, markAllNotificationsRead } =
  vi.hoisted(() => ({
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  }));

vi.mock("@/lib/api/notifications", () => ({
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a href="#settings" onClick={onClick}>
      {children}
    </a>
  ),
  useNavigate: () => () => Promise.resolve(),
}));

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

// Holds the unread count the way NotificationBell does, so the test reads the
// count from the panel header.
function Harness({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  return (
    <NotificationPanel
      unread={unread}
      onUnreadChange={setUnread}
      onRefreshUnread={() => {
        setUnread(0);
        return Promise.resolve();
      }}
      onNavigate={() => {}}
    />
  );
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markNotificationRead.mockResolvedValue(undefined);
    markAllNotificationsRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("marks a row read when it is opened", async () => {
    listNotifications.mockResolvedValue({
      notifications: [row({})],
      has_more: false,
    });
    render(<Harness initialUnread={2} />);

    fireEvent.click(await screen.findByText("Guide approved"));

    expect(await screen.findByText("1 unread")).toBeTruthy();
    expect(screen.queryByLabelText("Unread")).toBeNull();
  });

  it("does not lower the count when a read row is opened", async () => {
    listNotifications.mockResolvedValue({
      notifications: [row({ read_at: "2026-07-28T10:00:00Z" })],
      has_more: false,
    });
    render(<Harness initialUnread={2} />);

    fireEvent.click(await screen.findByText("Guide approved"));

    await waitFor(() => expect(screen.getByText("2 unread")).toBeTruthy());
  });

  it("clears every unread marker with Mark all as read", async () => {
    listNotifications.mockResolvedValue({
      notifications: [row({}), row({ data: { outcome: "rejected" } })],
      has_more: false,
    });
    render(<Harness initialUnread={2} />);
    expect(await screen.findAllByLabelText("Unread")).toHaveLength(2);

    fireEvent.click(screen.getByText("Mark all as read"));

    await waitFor(() => expect(screen.queryByLabelText("Unread")).toBeNull());
    expect(screen.queryByText(/unread$/)).toBeNull();
  });

  it("shows the empty state when there is nothing to show", async () => {
    listNotifications.mockResolvedValue({ notifications: [], has_more: false });
    render(<Harness initialUnread={0} />);

    expect(
      await screen.findByText("There are no new notifications")
    ).toBeTruthy();
  });

  it("skips types that have no renderer yet", async () => {
    listNotifications.mockResolvedValue({
      notifications: [
        row({ type: "guide_downvotes", category: "community_engagement" }),
      ],
      has_more: false,
    });
    render(<Harness initialUnread={1} />);

    expect(
      await screen.findByText("There are no new notifications")
    ).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    listNotifications
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ notifications: [row({})], has_more: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness initialUnread={1} />);

    fireEvent.click(await screen.findByText("Try again"));

    expect(await screen.findByText("Guide approved")).toBeTruthy();
  });
});
