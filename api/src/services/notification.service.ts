import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarkAllNotificationsRead,
  Notification,
  NotificationPreference,
  NotificationType,
  NotificationsQuery,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

// Every query runs on the caller's client, so RLS limits the rows to the
// caller's own notifications and preferences. public.notify() is the only
// writer of notifications; this service only reads them and sets read_at.

type DB = SupabaseClient<Database>;

const NOTIFICATION_COLUMNS = `
  id,
  type,
  group_count,
  data,
  occurred_at,
  read_at,
  notification_types!inner ( category ),
  actor:profiles!notifications_actor_id_fkey ( id, username )
`;

export async function listNotifications(
  supabase: DB,
  userId: string,
  query: NotificationsQuery
) {
  const first = (query.page - 1) * query.limit;

  let request = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("recipient_id", userId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });

  if (query.filter === "unread") request = request.is("read_at", null);
  if (query.category)
    request = request.eq("notification_types.category", query.category);

  // Read one extra row to learn whether another page exists.
  const { data, error } = await request.range(first, first + query.limit);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load notifications", 500);
  }

  const notifications: Notification[] = data
    .slice(0, query.limit)
    .map((row) => ({
      id: row.id,
      type: row.type as NotificationType,
      category: row.notification_types.category,
      actor: row.actor,
      count: row.group_count,
      data: row.data as Record<string, unknown>,
      occurred_at: row.occurred_at,
      read_at: row.read_at,
    }));

  return { notifications, has_more: data.length > query.limit };
}

export async function countUnreadNotifications(supabase: DB, userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to count notifications", 500);
  }

  return count ?? 0;
}

// Marking a notification that is already read keeps its first read time.
export async function markNotificationRead(
  supabase: DB,
  userId: string,
  id: string
) {
  const { data: marked, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to mark the notification read", 500);
  }

  if (marked.length > 0) return;

  const { data: existing, error: lookupError } = await supabase
    .from("notifications")
    .select("id")
    .eq("id", id)
    .eq("recipient_id", userId)
    .maybeSingle();

  if (lookupError) {
    console.error(lookupError);
    throw new ServiceError("Failed to mark the notification read", 500);
  }

  if (!existing) throw new ServiceError("Notification not found", 404);
}

export async function markAllNotificationsRead(
  supabase: DB,
  userId: string,
  input: MarkAllNotificationsRead
) {
  let request = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (input.category) {
    const { data: types, error: typesError } = await supabase
      .from("notification_types")
      .select("type")
      .eq("category", input.category);

    if (typesError) {
      console.error(typesError);
      throw new ServiceError("Failed to mark notifications read", 500);
    }

    request = request.in(
      "type",
      types.map((row) => row.type)
    );
  }

  const { error } = await request;

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to mark notifications read", 500);
  }
}

// Every registered type, with the caller's choice or the type default.
export async function listNotificationPreferences(
  supabase: DB,
  userId: string
): Promise<NotificationPreference[]> {
  const [types, saved] = await Promise.all([
    supabase
      .from("notification_types")
      .select("type, category, default_enabled")
      .order("type"),
    supabase
      .from("notification_preferences")
      .select("type, enabled")
      .eq("user_id", userId)
      .eq("channel", "in_app"),
  ]);

  if (types.error || saved.error) {
    console.error(types.error ?? saved.error);
    throw new ServiceError("Failed to load notification preferences", 500);
  }

  const savedByType = new Map(saved.data.map((row) => [row.type, row.enabled]));

  return types.data.map((row) => ({
    type: row.type as NotificationType,
    category: row.category,
    enabled: savedByType.get(row.type) ?? row.default_enabled,
  }));
}

export async function setNotificationPreference(
  supabase: DB,
  userId: string,
  type: NotificationType,
  enabled: boolean
) {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { user_id: userId, type, channel: "in_app", enabled },
      { onConflict: "user_id,type,channel" }
    );

  if (error) {
    // 23503: the type is not in public.notification_types.
    if (error.code === "23503")
      throw new ServiceError("Unknown notification type", 404);
    console.error(error);
    throw new ServiceError("Failed to save the notification preference", 500);
  }
}
