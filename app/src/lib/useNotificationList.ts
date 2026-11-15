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

// Tells the bell to recount after the page marks rows read.
export const NOTIFICATIONS_READ_EVENT = "bluelearn:notifications-read";

const PAGE_SIZE = 20;

// Shared by the bell panel and the notifications page.
export function useNotificationList(initialView = FILTER_VIEWS[0]) {
  const [view, setView] = useState(initialView);
  const [items, setItems] = useState<Array<Notification>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // A new load aborts the last, so an old view's late page never lands.
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

        // A new event can push a row onto the next page, so drop repeats.
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
    const category = view.category;

    try {
      await markAllNotificationsRead(category);
    } catch (error) {
      console.error(error);
      return false;
    }

    const readAt = new Date().toISOString();

    setItems((current) =>
      current.map((row) => {
        const matchesCategory =
          category === undefined || row.category === category;

        if (row.read_at || !matchesCategory) return row;

        return { ...row, read_at: readAt };
      })
    );

    return true;
  };

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
