import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  Notification,
  NotificationCategory,
  NotificationFilter,
} from "@bluelearn/schemas";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { notificationSections, renderNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationRow } from "@/components/notifications/NotificationRow";

type View = {
  label: string;
  filter: NotificationFilter;
  category?: NotificationCategory;
};

const FILTER_VIEWS: Array<View> = [
  { label: "All", filter: "all" },
  { label: "Unread", filter: "unread" },
];

const CATEGORY_VIEWS: Array<View> = notificationSections.map((section) => ({
  label: section.label,
  filter: "all",
  category: section.category,
}));

type NotificationPanelProps = {
  unread: number;
  onUnreadChange: (unread: number) => void;
  onRefreshUnread: () => Promise<void>;
  onNavigate: () => void;
};

export function NotificationPanel({
  unread,
  onUnreadChange,
  onRefreshUnread,
  onNavigate,
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>(FILTER_VIEWS[0]);
  const [items, setItems] = useState<Array<Notification>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (nextPage: number, signal?: AbortSignal) => {
      setLoading(true);
      setFailed(false);

      try {
        const result = await listNotifications(
          { page: nextPage, filter: view.filter, category: view.category },
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
        setHasMore(result.has_more);
      } catch (error) {
        if (signal?.aborted) return;

        console.error(error);
        setFailed(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  const open = async (item: Notification) => {
    const target = renderNotification(item)?.target;

    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, read_at: readAt } : row
        )
      );
      onUnreadChange(Math.max(0, unread - 1));
      // The page opens even if this fails; the next count poll corrects the
      // badge.
      markNotificationRead(item.id).catch((error: unknown) => {
        console.error(error);
      });
    }

    if (target) {
      onNavigate();
      await navigate(target);
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead(view.category);
    } catch (error) {
      console.error(error);
      return;
    }

    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((row) => (row.read_at ? row : { ...row, read_at: readAt }))
    );
    await onRefreshUnread();
  };

  const viewItem = (option: View) => (
    <DropdownMenuItem
      key={option.label}
      className="text-xs"
      onSelect={() => setView(option)}
    >
      {option.label}
    </DropdownMenuItem>
  );

  const shown = items.flatMap((item) => {
    const rendered = renderNotification(item);
    return rendered ? [{ item, rendered }] : [];
  });
  const isEmpty = shown.length === 0 && !loading;

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-xs font-bold tracking-[0.08em] uppercase"
            >
              {view.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 font-mono">
            {FILTER_VIEWS.map(viewItem)}
            <DropdownMenuSeparator />
            {CATEGORY_VIEWS.map(viewItem)}
          </DropdownMenuContent>
        </DropdownMenu>

        {unread > 0 && (
          <span className="text-xs text-brand-burnt-orange">
            {unread} unread
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="text-xs font-semibold text-brand-bright-blue hover:underline"
            >
              Mark all as read
            </button>
          )}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
          >
            <Link
              to="/settings/notifications"
              aria-label="Notification settings"
              onClick={onNavigate}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <p>Could not load your notifications.</p>
            <Button variant="outline" size="sm" onClick={() => load(1)}>
              Try again
            </Button>
          </div>
        )}

        {!failed && isEmpty && (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
            <img
              src="/assets/notifications/notifications-empty.png"
              alt=""
              className="w-56 max-w-full"
            />
            <p className="text-sm font-semibold">
              There are no new notifications
            </p>
          </div>
        )}

        {!failed && !isEmpty && (
          <ul>
            {shown.map(({ item, rendered }) => (
              <li key={item.id}>
                <NotificationRow
                  notification={item}
                  view={rendered}
                  onOpen={() => open(item)}
                />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !failed && (
          <div className="p-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => load(page + 1)}
            >
              Show older
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
