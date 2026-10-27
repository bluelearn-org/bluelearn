import type { Notification } from "@bluelearn/schemas";

import type { NotificationView } from "@/lib/notifications";
import { getAvatarUrl } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

type NotificationRowProps = {
  notification: Notification;
  view: NotificationView;
  onOpen: () => void;
};

export function NotificationRow({
  notification,
  view,
  onOpen,
}: NotificationRowProps) {
  const { actor, occurred_at, read_at } = notification;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
    >
      <Avatar className="h-9 w-9 shrink-0">
        {actor && (
          <AvatarImage
            src={getAvatarUrl(actor.id)}
            alt={`@${actor.username}`}
          />
        )}
        <AvatarFallback>
          <view.icon className="h-4 w-4 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs tracking-[0.08em] uppercase">
          {view.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{view.body}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <time dateTime={occurred_at} className="text-xs text-muted-foreground">
          {dateFormat.format(new Date(occurred_at))}
        </time>
        <span
          aria-label={read_at ? undefined : "Unread"}
          className={cn(
            "h-2 w-2 rounded-full",
            read_at ? "bg-transparent" : "bg-brand-burnt-orange"
          )}
        />
      </div>
    </button>
  );
}
