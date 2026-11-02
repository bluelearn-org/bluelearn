import type {
  NotificationCategory,
  NotificationFilter,
  NotificationType,
} from "@bluelearn/schemas";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const notifications = client.notifications;

type FetchOptions = { signal?: AbortSignal };

export type NotificationsPageQuery = {
  page?: number;
  filter?: NotificationFilter;
  category?: NotificationCategory;
};

export async function listNotifications(
  { page = 1, filter = "all", category }: NotificationsPageQuery = {},
  { signal }: FetchOptions = {}
) {
  const res = await notifications.$get(
    {
      query: {
        page: String(page),
        filter,
        ...(category ? { category } : {}),
      },
    },
    { init: { signal } }
  );
  await assertOk(res);

  return res.json();
}

export async function getUnreadNotificationCount({
  signal,
}: FetchOptions = {}) {
  const res = await notifications["unread-count"].$get(undefined, {
    init: { signal },
  });
  await assertOk(res);

  const { count } = await res.json();
  return count;
}

export async function markNotificationRead(id: string) {
  const res = await notifications[":id"].read.$post({ param: { id } });
  await assertOk(res);
}

// Without a category, every unread notification is marked read.
export async function markAllNotificationsRead(
  category?: NotificationCategory
) {
  const res = await notifications["read-all"].$post({
    json: category ? { category } : {},
  });
  await assertOk(res);
}

export async function getNotificationPreferences({
  signal,
}: FetchOptions = {}) {
  const res = await notifications.preferences.$get(undefined, {
    init: { signal },
  });
  await assertOk(res);

  const { preferences } = await res.json();
  return preferences;
}

export async function setNotificationPreference(
  type: NotificationType,
  enabled: boolean
) {
  const res = await notifications.preferences[":type"].$put({
    param: { type },
    json: { enabled },
  });
  await assertOk(res);
}
