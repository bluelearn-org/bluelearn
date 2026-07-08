import type { Database } from "../../src/database.types";
import { admin, insert } from "../helpers";

type AppRole = Database["public"]["Enums"]["app_role"];

// Role grants are admin-only in prod, so the factory writes with the service
// client. makeUser's signup trigger already created the profile row.
export function grantRole(userId: string, role: AppRole) {
  return insert("user_roles", { user_id: userId, role });
}

export async function getUsername(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data.username;
}

export async function suspendProfile(userId: string) {
  const { error } = await admin
    .from("profiles")
    .update({ is_suspended: true })
    .eq("id", userId);
  if (error) throw error;
}
