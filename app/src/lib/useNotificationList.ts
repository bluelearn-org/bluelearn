import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Notification,
  NotificationCategory,
  NotificationFilter,
} from "@bluelearn/schemas";

import type { NotificationView } from "@/lib/notifications";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { notificationSections, renderNotification } from "@/lib/notifications";

export type NotificationListView = {
  label: string;
  filter: NotificationFilter;
  category?: NotificationCategory;
};

export type NotificationListRow = {
  item: Notification;
  rendered: NotificationView;
};

export const FILTER_VIEWS: Array<NotificationListView> = [
  { label: "All", filter: "all" },
  { label: "Unread", filter: "unread" },
];

export const CATEGORY_VIEWS: Array<NotificationListView> =
  notificationSections.map((section) => ({
    label: section.label,
    filter: "all",
    category: section.category,
  }));

// The notifications page sends this after the server marks rows read, so the
// bell counts again.
export const NOTIFICATIONS_READ_EVENT = "bluelearn:notifications-read";

const PAGE_SIZE = 20;

// One list of the signed-in user's notifications, shared by the bell panel and
// the notifications page.
export function useNotificationList() {
  const [view, setView] = useState(FILTER_VIEWS[0]);
  const [items, setItems] = useState<Array<Notification>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Starting any load aborts the one before it, so a late page from an old
  // view never lands in the new one.
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;

      setLoading(true);
      setFailed(false);

      try {
        const result = await listNotifications(
          {
            page: nextPage,
            limit: PAGE_SIZE,
            filter: view.filter,
            category: view.category,
          },
          { signal }
        );
        // A row can move to the next page when a new event arrives, so drop
        // repeats by id.
        setItems((current) => {
          const kept = nextPage === 1 ? [] : current;
          const seen = new Set(kept.map((item) => item.id));
          return [
            ...kept,
            ...result.notifications.filter((item) => !seen.has(item.id)),
          ];
        });
        setPage(nextPage);
        setHasMore(nextPage * PAGE_SIZE < result.total);
      } catch (error) {
        if (signal.aborted) return;

        console.error(error);
        setFailed(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [view]
  );

  useEffect(() => {
    void load(1);
    return () => controllerRef.current?.abort();
  }, [load]);

  const reload = () => load(1);

  const loadOlder = useCallback(() => load(page + 1), [load, page]);

  // Shows the row read at once and resolves to whether the server saved it.
  const markRead = useCallback((item: Notification) => {
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read_at: readAt } : row
      )
    );

    return markNotificationRead(item.id).then(
      () => true,
      (error: unknown) => {
        console.error(error);
        return false;
      }
    );
  }, []);

  // Marks the current view read and resolves to whether the server saved it.
  const markAll = async () => {
    try {
      await markAllNotificationsRead(view.category);
    } catch (error) {
      console.error(error);
      return false;
    }

    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((row) => (row.read_at ? row : { ...row, read_at: readAt }))
    );
    return true;
  };

  // Types without a renderer stay hidden.
  const rows = useMemo(
    () =>
      items.flatMap((item): Array<NotificationListRow> => {
        const rendered = renderNotification(item);
        return rendered ? [{ item, rendered }] : [];
      }),
    [items]
  );

  return {
    view,
    setView,
    rows,
    hasMore,
    loading,
    failed,
    reload,
    loadOlder,
    markRead,
    markAll,
  };
}

export type NotificationList = ReturnType<typeof useNotificationList>;
