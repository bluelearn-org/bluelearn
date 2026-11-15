import {
  Link,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { notificationsQuerySchema } from "@bluelearn/schemas";
import type { Notification } from "@bluelearn/schemas";

import type {
  NotificationListRow,
  NotificationListView,
} from "@/lib/useNotificationList";
import { requireSession } from "@/lib/auth";
import { useAuth } from "@/lib/authContext";
import { notificationAnchor } from "@/lib/notifications";
import {
  CATEGORY_VIEWS,
  FILTER_VIEWS,
  NOTIFICATIONS_READ_EVENT,
  useNotificationList,
} from "@/lib/useNotificationList";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProfileTabs } from "@/components/ProfileTabs";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationViewMenu } from "@/components/notifications/NotificationViewMenu";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  beforeLoad: requireSession,
  validateSearch: notificationsQuerySchema.pick({
    filter: true,
    category: true,
  }),
  component: RouteComponent,
});

type NotificationsPageProps = {
  hash: string;
  initialView: NotificationListView;
};

function RouteComponent() {
  const hash = useLocation({ select: (location) => location.hash });
  const { filter, category } = Route.useSearch();
  const view = category
    ? CATEGORY_VIEWS.find((entry) => entry.category === category)
    : FILTER_VIEWS.find((entry) => entry.filter === filter);

  return (
    <NotificationsPage
      key={`${category ?? filter}:${hash}`}
      hash={hash}
      initialView={view ?? FILTER_VIEWS[0]}
    />
  );
}

function NotificationsPage({ hash, initialView }: NotificationsPageProps) {
  const navigate = useNavigate();
  const { currentProfile } = useAuth();
  const list = useNotificationList(initialView);
  const { rows, hasMore, loading, failed, loadOlder, markRead } = list;
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

    const target =
      rendered.pageTarget === undefined ? rendered.target : rendered.pageTarget;

    if (target) await navigate(target);
  };

  const markAll = async () => {
    if (await list.markAll()) announceRead();
  };

  const changeView = (view: NotificationListView) =>
    navigate({
      to: "/notifications",
      search: { filter: view.filter, category: view.category },
      hash: "",
    });

  const focused = rows.find(({ item }) => notificationAnchor(item.id) === hash);

  // Load pages until the linked row shows, then scroll to it and mark it read.
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
      <section className="border-b px-8 py-8 lg:px-16">
        {currentProfile && <ProfileTabs username={currentProfile.username} />}

        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Notifications
          </h1>
        </div>

        <Separator className="mb-4 bg-border" />

        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 pb-4">
            <NotificationViewMenu view={list.view} onViewChange={changeView} />

            <div className="ml-auto flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="outline"
                  size="lg"
                  className="btn-sec"
                  onClick={markAll}
                >
                  Mark all as read
                </Button>
              )}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md"
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
                    "scroll-mt-24 border-b",
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
                      className="space-y-2 pr-4 pb-3 pl-16"
                    >
                      {feedback.map((entry, index) => (
                        <li
                          key={index}
                          className="flex flex-col items-start gap-1 sm:flex-row sm:gap-2"
                        >
                          {entry.reason && (
                            <Badge
                              variant="outline"
                              className="mono-micro shrink-0 rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                            >
                              {entry.reason}
                            </Badge>
                          )}
                          {entry.note && (
                            <p className="min-w-0 text-sm break-words text-muted-foreground">
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

function announceRead() {
  window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
}
