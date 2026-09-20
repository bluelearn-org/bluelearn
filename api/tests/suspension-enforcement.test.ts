import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import app from "../src/index";
import type { Database } from "../src/database.types";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";

type UserClient = SupabaseClient<Database>;

function userClient(token: string): UserClient {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

async function setSuspended(userId: string) {
  const { error } = await admin
    .from("user_statuses")
    .update({ status: "suspended" })
    .eq("user_id", userId);
  if (error) throw error;
}

async function profileSuspension(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("is_suspended")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data.is_suspended;
}

describe("suspension enforcement across API and Supabase", () => {
  it("mirrors suspended status into the uncached identity response", async () => {
    const { token, userId } = await makeUser();
    expect(await profileSuspension(userId)).toBe(false);
    await setSuspended(userId);
    expect(await profileSuspension(userId)).toBe(true);

    const response = await app.request("/me", auth(token), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const identity = (await response.json()) as {
      profile: { is_suspended: boolean };
    };
    expect(identity.profile.is_suspended).toBe(true);
  });

  it("returns the exact 403 for a suspended route mutation", async () => {
    const { token, userId } = await makeUser();
    await setSuspended(userId);

    const response = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        title: "Must not be created",
        body: "No side effect.",
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Suspended users cannot create or edit guides.",
    });
  });

  it("blocks archive mutations after suspension", async () => {
    const { token, userId } = await makeUser();
    const createResponse = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        title: `Archive guard ${crypto.randomUUID()}`,
        body: "A guide body.",
      }),
      env
    );
    expect(createResponse.status).toBe(201);

    const { revision_id } = (await createResponse.json()) as {
      revision_id: string;
    };
    const { data: revision, error } = await admin
      .from("guide_revisions")
      .select("guide_id")
      .eq("id", revision_id)
      .single();
    if (error) throw error;

    await setSuspended(userId);
    const direct = await userClient(token)
      .from("guides")
      .update({ status: "archived" })
      .eq("id", revision.guide_id)
      .select("status");
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);

    const { data: storedGuide, error: storedGuideError } = await admin
      .from("guides")
      .select("status")
      .eq("id", revision.guide_id)
      .single();
    if (storedGuideError) throw storedGuideError;
    expect(storedGuide.status).toBe("draft");

    const response = await app.request(
      `/variants/${revision.guide_id}`,
      { method: "DELETE", ...auth(token) },
      env
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Suspended users cannot create or edit guides.",
    });
  });

  it("does not let a suspended user reset profiles.is_suspended directly", async () => {
    const { token, userId } = await makeUser();
    const client = userClient(token);
    await setSuspended(userId);
    const attempt = await client
      .from("profiles")
      .update({ is_suspended: false })
      .eq("id", userId);

    expect(attempt.error).not.toBeNull();
    expect(await profileSuspension(userId)).toBe(true);
  });

  it("rejects direct create_guide RPC writes under RLS while active control succeeds", async () => {
    const active = await makeUser();
    const suspended = await makeUser();
    const activeClient = userClient(active.token);
    const activeRpc = await activeClient.rpc("create_guide", {
      p_title: "Active RPC guide",
      p_summary: "Created through the database boundary.",
      p_body: "Body",
      p_knowledge_type: "theoretical",
    });
    expect(activeRpc.error).toBeNull();
    expect(activeRpc.data).toEqual(expect.any(String));

    const suspendedClient = userClient(suspended.token);
    await setSuspended(suspended.userId);
    const refused = await suspendedClient.rpc("create_guide", {
      p_title: "Suspended RPC guide",
      p_summary: "Must be rejected.",
      p_body: "Body",
      p_knowledge_type: "theoretical",
    });
    expect(refused.error).not.toBeNull();
  });

  it("keeps canonical promotion fixed to its public thresholds", async () => {
    const { token, userId } = await makeUser();
    const client = userClient(token);
    const guideBaseId = crypto.randomUUID();
    await setSuspended(userId);

    const fixedPolicy = await client.rpc("promote_canonical_guide", {
      p_guide_base_id: guideBaseId,
    });
    expect(fixedPolicy.error).toBeNull();
    expect(fixedPolicy.data).toBeNull();

    const customPolicy = await client.rpc("promote_canonical_guide", {
      p_guide_base_id: guideBaseId,
      p_z: 1.96,
      p_margin: -1,
      p_min_votes: 0,
    });
    expect(customPolicy.error?.message).toContain(
      "Custom canonical promotion thresholds are not permitted"
    );

    const trustedPolicy = await admin.rpc("promote_canonical_guide", {
      p_guide_base_id: guideBaseId,
      p_z: 1.96,
      p_margin: -1,
      p_min_votes: 0,
    });
    expect(trustedPolicy.error).toBeNull();
    expect(trustedPolicy.data).toBeNull();
  });
});
