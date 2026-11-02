import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getUnreadNotificationCount } from "@/lib/api/notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

// The count updates once a minute and on window focus, so a new notification
// can take up to a minute to show. Push updates (a Durable Object or a queue
// consumer) when that delay is too slow or the poll load matters.
const POLL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshCount = useCallback(async (signal?: AbortSignal) => {
    try {
      setUnread(await getUnreadNotificationCount({ signal }));
    } catch (error) {
      // A failed poll keeps the last count. The next poll tries again.
      if (!signal?.aborted) console.error(error);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const poll = () => {
      if (document.visibilityState === "visible")
        void refreshCount(controller.signal);
    };

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    window.addEventListener("focus", poll);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [refreshCount]);

  const label =
    unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-md"
          aria-label={label}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand-burnt-orange"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex h-[min(32rem,calc(100svh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
      >
        <NotificationPanel
          unread={unread}
          onUnreadChange={setUnread}
          onRefreshUnread={refreshCount}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
