import type { ReactNode } from "react";

import type {
  NotificationList,
  NotificationListRow,
} from "@/lib/useNotificationList";
import { Button } from "@/components/ui/button";

type NotificationFeedProps = {
  list: NotificationList;
  renderRow: (row: NotificationListRow) => ReactNode;
  className?: string;
};

export function NotificationFeed({
  list,
  renderRow,
  className,
}: NotificationFeedProps) {
  const { rows, loading, failed, hasMore, reload, loadOlder } = list;
  const isEmpty = rows.length === 0 && !loading;

  return (
    <div className={className}>
      {failed && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>Could not load your notifications.</p>
          <Button variant="outline" size="sm" onClick={reload}>
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
          {rows.map((row) => (
            <li key={row.item.id}>{renderRow(row)}</li>
          ))}
        </ul>
      )}

      {hasMore && !failed && (
        <div className="p-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={loadOlder}
          >
            Show older
          </Button>
        </div>
      )}
    </div>
  );
}
