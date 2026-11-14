import { Link, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import type { NotificationListRow } from "@/lib/useNotificationList";
import { useNotificationList } from "@/lib/useNotificationList";
import { Button } from "@/components/ui/button";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationViewMenu } from "@/components/notifications/NotificationViewMenu";

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
  const list = useNotificationList();

  const open = async ({ item, rendered }: NotificationListRow) => {
    if (!item.read_at) {
      // The next count poll corrects the badge if this fails.
      void list.markRead(item);
      onUnreadChange(Math.max(0, unread - 1));
    }

    if (rendered.target) {
      onNavigate();
      await navigate(rendered.target);
    }
  };

  const markAll = async () => {
    if (await list.markAll()) await onRefreshUnread();
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <NotificationViewMenu view={list.view} onViewChange={list.setView} />

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

      <NotificationFeed
        list={list}
        className="min-h-0 flex-1 overflow-y-auto"
        renderRow={(row) => (
          <NotificationRow
            notification={row.item}
            view={row.rendered}
            onOpen={() => open(row)}
            showHint
          />
        )}
      />

      <div className="border-t px-4 py-2 text-center">
        <Link
          to="/notifications"
          onClick={onNavigate}
          className="text-xs font-semibold text-brand-bright-blue hover:underline"
        >
          View all
        </Link>
      </div>
    </>
  );
}
