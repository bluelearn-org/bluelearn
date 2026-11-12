import {
  Link,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { Notification } from "@bluelearn/schemas";

import type { NotificationListRow } from "@/lib/useNotificationList";
import { requireSession } from "@/lib/auth";
import { useAuth } from "@/lib/authContext";
import { notificationAnchor } from "@/lib/notifications";
import {
  NOTIFICATIONS_READ_EVENT,
  useNotificationList,
} from "@/lib/useNotificationList";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProfileTabs } from "@/components/ProfileTabs";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationViewMenu } from "@/components/notifications/NotificationViewMenu";

export const Route = createFileRoute("/profile/notifications")({
  ssr: false,
  beforeLoad: requireSession,
  component: RouteComponent,
});

// Once the server has marked rows read, the bell counts again.
function announceRead() {
  window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
}

function RouteComponent() {
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });
  const { currentProfile } = useAuth();
  const list = useNotificationList();
  const { rows, hasMore, loading, failed, loadOlder, markRead } = list;
  // The hash this page has already scrolled to.
  const shownHashRef = useRef<string | null>(null);

  const markOpened = useCallback(
    (item: Notification) => {
      if (item.read_at) return;

      void markRead(item).then((saved) => {
        if (saved) announceRead();
      });
    },
    [markRead]
  );

  const open = async ({ item, rendered }: NotificationListRow) => {
    markOpened(item);
    if (rendered.target) await navigate(rendered.target);
  };

  const markAll = async () => {
    if (await list.markAll()) announceRead();
  };

  const focused = rows.find(({ item }) => notificationAnchor(item.id) === hash);

  // A link from the bell names one row by its hash. Older pages load until
  // that row shows, then the page scrolls to it and marks it read.
  useEffect(() => {
    if (!hash || shownHashRef.current === hash) return;

    if (!focused) {
      if (hasMore && !loading && !failed) void loadOlder();
      return;
    }

    shownHashRef.current = hash;
    document.getElementById(hash)?.scrollIntoView();
    markOpened(focused.item);
  }, [hash, focused, hasMore, loading, failed, loadOlder, markOpened]);

  const hasUnread = rows.some(({ item }) => !item.read_at);

  return (
    <div className="mx-auto max-w-7xl bg-background">
      <section className="border-b px-4 py-8 sm:px-8 sm:py-10 lg:px-16">
        {currentProfile && <ProfileTabs username={currentProfile.username} />}

        <div className="max-w-3xl">
          <div className="flex items-center gap-3 border-b px-4 pb-3">
            <NotificationViewMenu
              view={list.view}
              onViewChange={list.setView}
            />

            <div className="ml-auto flex items-center gap-2">
              {hasUnread && (
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
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <NotificationFeed
            list={list}
            renderRow={(row) => {
              const anchor = notificationAnchor(row.item.id);
              const feedback = row.rendered.feedback ?? [];

              return (
                <div
                  id={anchor}
                  className={cn(
                    "scroll-mt-24",
                    anchor === hash && "bg-muted/50"
                  )}
                >
                  <NotificationRow
                    notification={row.item}
                    view={row.rendered}
                    onOpen={() => open(row)}
                  />
                  {feedback.length > 0 && (
                    <ul
                      aria-label="Downvote reasons"
                      className="space-y-2 pr-4 pb-3 pl-16 text-xs"
                    >
                      {feedback.map((entry, index) => (
                        <li key={index}>
                          {entry.reason && (
                            <p className="font-semibold">{entry.reason}</p>
                          )}
                          {entry.note && (
                            <p className="text-muted-foreground">
                              {entry.note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            }}
          />
        </div>
      </section>
    </div>
  );
}
