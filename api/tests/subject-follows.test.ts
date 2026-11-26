import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { profilePageResponseSchema } from "@bluelearn/schemas";
import app from "../src/index";
import type { Database } from "../src/database.types";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { createSubject } from "./factories/subjects";
import { getUsername } from "./factories/identity";
import { expectToMatchSpec } from "./openapi";

describe("private subject follows", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let other: Awaited<ReturnType<typeof makeUser>>;
  let subject: Awaited<ReturnType<typeof createSubject>>;
  let username: string;
  const users: string[] = [];
  const subjects: string[] = [];
  const client = (token?: string) =>
    createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const request = (method: string, token?: string, slug = subject.slug) =>
    app.request(
      `/subjects/${slug}/follow`,
      { method, ...auth(token ?? "") },
      env
    );

  beforeAll(async () => {
    owner = await makeUser();
    users.push(owner.userId);
    other = await makeUser();
    users.push(other.userId);
    subject = await createSubject();
    subjects.push(subject.id);
    username = await getUsername(owner.userId);
  });

  beforeEach(async () => {
    const { error } = await admin
      .from("subject_follows")
      .delete()
      .in("user_id", [owner.userId, other.userId]);
    if (error) throw error;
  });

  afterAll(async () => {
    for (let i = 0; i < subjects.length; i += 100) {
      const { error } = await admin
        .from("subjects")
        .delete()
        .in("id", subjects.slice(i, i + 100));
      if (error) throw error;
    }
    await admin.from("profiles").delete().in("id", users);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it.each(["GET", "PUT", "DELETE"])("rejects anonymous %s", async (method) => {
    const res = await app.request(
      `/subjects/${subject.slug}/follow`,
      { method },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, method, "/subjects/{slug}/follow");
  });

  it.each(["GET", "PUT", "DELETE"])(
    "returns 404 for an unknown subject on %s",
    async (method) => {
      const res = await request(method, owner.token, "missing-subject-523");
      expect(res.status).toBe(404);
      await expectToMatchSpec(res, method, "/subjects/{slug}/follow");
    }
  );

  it("starts unfollowed and shows an empty owner list", async () => {
    const res = await request("GET", owner.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ following: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const profile = await app.request(
      `/profiles/${username}`,
      auth(owner.token),
      env
    );
    expect(
      profilePageResponseSchema.parse(await profile.json()).followed_subjects
    ).toEqual([]);
  });

  it("persists concurrent repeated follows without accepting a client user ID", async () => {
    const responses = await Promise.all([
      request("PUT", owner.token),
      app.request(
        `/subjects/${subject.slug}/follow`,
        jsonAuth(owner.token, "PUT", { user_id: other.userId }),
        env
      ),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "PUT", "/subjects/{slug}/follow");
      expect(await res.json()).toEqual({ following: true });
    }
    expect(await (await request("GET", owner.token)).json()).toEqual({
      following: true,
    });
    expect(await (await request("GET", other.token)).json()).toEqual({
      following: false,
    });
    const rows = await admin
      .from("subject_follows")
      .select("user_id")
      .eq("subject_id", subject.id);
    expect(rows.error).toBeNull();
    expect(rows.data).toEqual([{ user_id: owner.userId }]);
  });

  it("includes subject navigation only in the owner's profile response", async () => {
    expect((await request("PUT", owner.token)).status).toBe(200);
    for (const token of [owner.token, other.token, undefined]) {
      const res = await app.request(
        `/profiles/${username}`,
        token ? auth(token) : {},
        env
      );
      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "GET", "/profiles/{username}");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = profilePageResponseSchema.parse(await res.json());
      if (token === owner.token) {
        expect(body.followed_subjects).toEqual([
          { slug: subject.slug, name: subject.name },
        ]);
      } else {
        expect(body).not.toHaveProperty("followed_subjects");
      }
    }
  });

  it("enforces ownership on direct database reads, inserts, deletes and updates", async () => {
    expect((await request("PUT", owner.token)).status).toBe(200);
    const theirs = client(other.token);
    const read = await theirs.from("subject_follows").select("*");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const write = await theirs
      .from("subject_follows")
      .insert({ user_id: owner.userId, subject_id: subject.id });
    expect(write.error?.code).toBe("42501");
    const remove = await theirs
      .from("subject_follows")
      .delete()
      .eq("user_id", owner.userId)
      .select();
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);
    const update = await client(owner.token)
      .from("subject_follows")
      .update({ user_id: other.userId })
      .eq("subject_id", subject.id);
    expect(update.error?.code).toBe("42501");
    expect(await (await request("GET", owner.token)).json()).toEqual({
      following: true,
    });
  });

  it("denies anonymous database access", async () => {
    const anon = client();
    expect((await anon.from("subject_follows").select("*")).error?.code).toBe(
      "42501"
    );
    expect(
      (
        await anon
          .from("subject_follows")
          .insert({ user_id: owner.userId, subject_id: subject.id })
      ).error?.code
    ).toBe("42501");
    expect(
      (await anon.from("subject_follows").delete().eq("subject_id", subject.id))
        .error?.code
    ).toBe("42501");
  });

  it("rejects following draft subjects even through direct database access", async () => {
    const draft = await createSubject({
      status: "draft",
      creator_id: owner.userId,
    });
    subjects.push(draft.id);
    const res = await request("PUT", owner.token, draft.slug);
    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "PUT", "/subjects/{slug}/follow");
    expect(await res.json()).toEqual({ error: "Subject cannot be followed" });
    const write = await client(owner.token)
      .from("subject_follows")
      .insert({ user_id: owner.userId, subject_id: draft.id });
    expect(write.error?.code).toBe("42501");
  });

  it("returns the entire private list beyond the database row limit", async () => {
    const prefix = `follow-${crypto.randomUUID()}`;
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: crypto.randomUUID(),
      slug: `${prefix}-${index}`,
      name: `Follow Test ${String(index).padStart(4, "0")}`,
      status: "published" as const,
    }));
    subjects.push(...rows.map((row) => row.id));
    expect((await admin.from("subjects").insert(rows)).error).toBeNull();
    expect(
      (
        await admin
          .from("subject_follows")
          .insert(
            rows.map((row) => ({ user_id: owner.userId, subject_id: row.id }))
          )
      ).error
    ).toBeNull();
    const res = await app.request(
      `/profiles/${username}`,
      auth(owner.token),
      env
    );
    expect(res.status).toBe(200);
    const body = profilePageResponseSchema.parse(await res.json());
    expect(body.followed_subjects).toEqual(
      rows.map(({ slug, name }) => ({ slug, name }))
    );
  });

  it("enforces unique pairs and valid foreign keys in PostgreSQL", async () => {
    expect((await request("PUT", owner.token)).status).toBe(200);
    expect(
      (
        await admin
          .from("subject_follows")
          .insert({ user_id: owner.userId, subject_id: subject.id })
      ).error?.code
    ).toBe("23505");
    expect(
      (
        await admin
          .from("subject_follows")
          .insert({ user_id: owner.userId, subject_id: crypto.randomUUID() })
      ).error?.code
    ).toBe("23503");
    expect(
      (
        await admin
          .from("subject_follows")
          .insert({ user_id: crypto.randomUUID(), subject_id: subject.id })
      ).error?.code
    ).toBe("23503");
  });

  it("unfollows idempotently without affecting other users", async () => {
    expect((await request("PUT", owner.token)).status).toBe(200);
    expect((await request("DELETE", other.token)).status).toBe(200);
    expect(await (await request("GET", owner.token)).json()).toEqual({
      following: true,
    });
    for (let i = 0; i < 2; i++) {
      const res = await request("DELETE", owner.token);
      expect(res.status).toBe(200);
      await expectToMatchSpec(res, "DELETE", "/subjects/{slug}/follow");
      expect(await res.json()).toEqual({ following: false });
    }
    expect(await (await request("GET", owner.token)).json()).toEqual({
      following: false,
    });
    const profile = await app.request(
      `/profiles/${username}`,
      auth(owner.token),
      env
    );
    expect(
      profilePageResponseSchema.parse(await profile.json()).followed_subjects
    ).toEqual([]);
  });

  it("cascades follows when the subject or profile is deleted", async () => {
    const disposable = await createSubject();
    subjects.push(disposable.id);
    expect((await request("PUT", owner.token, disposable.slug)).status).toBe(
      200
    );
    expect(
      (await admin.from("subjects").delete().eq("id", disposable.id)).error
    ).toBeNull();
    expect(
      (
        await admin
          .from("subject_follows")
          .select("*")
          .eq("subject_id", disposable.id)
      ).data
    ).toEqual([]);
    const deletedUser = await makeUser();
    users.push(deletedUser.userId);
    expect((await request("PUT", deletedUser.token)).status).toBe(200);
    expect(
      (await admin.from("profiles").delete().eq("id", deletedUser.userId)).error
    ).toBeNull();
    expect(
      (
        await admin
          .from("subject_follows")
          .select("*")
          .eq("user_id", deletedUser.userId)
      ).data
    ).toEqual([]);
  });
});
