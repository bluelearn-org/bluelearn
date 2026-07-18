import { hc } from "hono/client";
import type { AppType } from "api";
import { supabase } from "@/lib/supabase";

export const client = hc<AppType>(import.meta.env.VITE_API_BASE, {
  headers: async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  },
});
