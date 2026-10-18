import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdult } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

export async function getDateOfBirth(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("account_details")
    .select("date_of_birth")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ServiceError("Failed to load account details", 500);
  return data?.date_of_birth ?? null;
}

export async function saveDateOfBirth(
  supabase: DB,
  userId: string,
  dateOfBirth: string | null
) {
  const { error } = await supabase.from("account_details").upsert({
    user_id: userId,
    date_of_birth: dateOfBirth,
  });
  if (error) throw new ServiceError("Failed to save date of birth", 400);
  return { date_of_birth: dateOfBirth };
}

export async function getContentAccess(
  supabase: DB,
  disclaimers: string[],
  confirmed = false
) {
  if (!disclaimers.includes("mature")) return "allowed" as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "sign_in_required" as const;
  const dateOfBirth = await getDateOfBirth(supabase, user.id);
  if (!dateOfBirth) return "date_of_birth_required" as const;
  if (!isAdult(dateOfBirth)) return "underage" as const;
  return confirmed ? ("allowed" as const) : ("confirmation_required" as const);
}

export async function getReaderMetadata(supabase: DB, guideId: string) {
  const { data, error } = await supabase.rpc("get_guide_reader_metadata", {
    p_guide_id: guideId,
  });
  if (error) throw new ServiceError("Failed to load guide metadata", 500);
  return data?.[0] ? { ...data[0], body: null } : null;
}
