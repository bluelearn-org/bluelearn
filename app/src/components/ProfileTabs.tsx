import { Link, useMatchRoute } from "@tanstack/react-router";
import { Bell, User } from "lucide-react";

import { useAuth } from "@/lib/authContext";
import { cn } from "@/lib/utils";

type PropTypes = {
  // The profile on screen. The tabs only show on the signed-in user's own.
  username: string;
};

export function ProfileTabs({ username }: PropTypes) {
  const { currentProfile } = useAuth();
  const matchRoute = useMatchRoute();

  if (currentProfile?.username !== username) return null;

  const tabClass = (active: boolean) =>
    cn(
      "data-label flex shrink-0 items-center gap-2 border-b-2 border-transparent py-3 whitespace-nowrap",
      active && "border-primary font-bold text-primary"
    );

  return (
    <nav className="mb-8 overflow-x-auto border-b">
      <ul className="flex w-max items-center gap-6">
        <li>
          <Link
            to="/profile/$username"
            params={{ username }}
            className={tabClass(
              Boolean(
                matchRoute({ to: "/profile/$username", params: { username } })
              )
            )}
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
        </li>
        <li>
          <Link
            to="/profile/notifications"
            className={tabClass(
              Boolean(matchRoute({ to: "/profile/notifications" }))
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
        </li>
      </ul>
    </nav>
  );
}
