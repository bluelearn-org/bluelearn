import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(
  email: string,
  password: string,
  username: string
) {
  // username rides along as user metadata; the handle_new_user trigger reads it
  // to seed the profile row.
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
