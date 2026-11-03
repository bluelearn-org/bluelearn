import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { subjectsTableResponseSchema } from "@bluelearn/schemas";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import {
  createSubject,
  tagGuideRevision,
  tagObjectiveRevision,
} from "./factories/subjects";
import { createGuideRevision, createPublishedGuide } from "./factories/guides";
import {
  createObjectiveRevision,
  createPublishedObjective,
} from "./factories/objectives";
import { expectToMatchSpec } from "./openapi";

const path = "/dashboard/subjects";
const manage = (
  token: string,
  ids: string[],
  target = ids[0],
  name = "Merged subject",
  summary: string | null = "Updated summary"
) =>
  app.request(
    `${path}/manage`,
    jsonAuth(token, "POST", {
      subject_ids: ids,
      target_id: target,
      name,
      summary,
    }),
    env
  );
async function manager(role: "admin" | "lead-verifier" = "admin") {
  const user = await makeUser();
  await grantRole(user.userId, role);
  return user;
}
const subject = (id: string) =>
  admin.from("subjects").select("*").eq("id", id).maybeSingle().throwOnError();

describe("dashboard subject management", () => {
  it("refreshes the retained subject's guide search cards after an edit", async () => {
    const author = await manager();
    const row = await createSubject({ name: "Original search subject" });
    const guide = await createPublishedGuide({ authorId: author.userId });
    await tagGuideRevision(guide.revision.id, row.id);
    const backgroundTasks: Array<Promise<unknown>> = [];
    const originalFetch = globalThis.fetch;
    const documents: Array<{ tags?: Array<{ name: string; slug: string }> }> =
      [];
    const fakeFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (
          typeof input === "string" &&
          input.startsWith("http://subject-search.test:80/")
        ) {
          documents.push(JSON.parse(String(init?.body)));
          return new Response("{}", { status: 200 });
        }
        return originalFetch(input, init);
      });
    try {
      const response = await app.request(
        `${path}/manage`,
        jsonAuth(author.token, "POST", {
          subject_ids: [row.id],
          target_id: row.id,
          name: "Updated search subject",
          summary: "",
        }),
        {
          ...env,
          TYPESENSE_HOST: "subject-search.test",
          TYPESENSE_PORT: "80",
          TYPESENSE_PROTOCOL: "http",
        },
        {
          waitUntil: (task) => {
            backgroundTasks.push(task);
          },
          passThroughOnException: () => {},
          props: {},
        }
      );
      expect(response.status).toBe(200);
      expect(backgroundTasks).toHaveLength(1);
      await Promise.all(backgroundTasks);
      expect(documents).toHaveLength(1);
      expect(documents[0].tags).toContainEqual({
        name: "Updated search subject",
        slug: row.slug,
      });
    } finally {
      fakeFetch.mockRestore();
    }
  });
  it("requires authentication for listing and mutations", async () => {
    expect((await app.request(path, {}, env)).status).toBe(401);
    expect(
      (await app.request(`${path}/manage`, { method: "POST" }, env)).status
    ).toBe(401);
  });

  it.each([null, "verifier", "moderator", "curator", "official"] as const)(
    "denies non-managers with role %s",
    async (role) => {
      const user = await makeUser();
      if (role) await grantRole(user.userId, role);
      const row = await createSubject();
      const list = await app.request(path, auth(user.token), env);
      expect(list.status).toBe(403);
      expect((await manage(user.token, [row.id])).status).toBe(403);
      expect((await subject(row.id)).data?.name).toBe(row.name);
      const client = createClient(
        env.SUPABASE_URL,
        env.SUPABASE_PUBLISHABLE_KEY,
        {
          global: { headers: { Authorization: `Bearer ${user.token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );
      const { error } = await client.rpc("manage_subjects", {
        p_subject_ids: [row.id],
        p_target_id: row.id,
        p_name: "Bypass attempt",
        p_summary: "",
      });
      expect(error?.code).toBe("42501");
    }
  );

  it.each(["admin", "lead-verifier"] as const)(
    "lets %s list other authors' draft subjects and edit one without changing its URL",
    async (role) => {
      const user = await manager(role);
      const name = `Draft ${crypto.randomUUID().slice(0, 8)}`;
      const row = await createSubject({ name, status: "draft", slug: null });
      const list = await app.request(
        `${path}?name=${encodeURIComponent(name)}`,
        auth(user.token),
        env
      );
      expect(list.status).toBe(200);
      await expectToMatchSpec(list.clone(), "GET", path);
      expect(
        subjectsTableResponseSchema
          .parse(await list.json())
          .data.map((item) => item.id)
      ).toContain(row.id);
      const result = await manage(
        user.token,
        [row.id],
        row.id,
        "  Corrected name  ",
        "  Better summary  "
      );
      expect(result.status).toBe(200);
      await expectToMatchSpec(result, "POST", `${path}/manage`);
      expect((await subject(row.id)).data).toMatchObject({
        name: "Corrected name",
        summary: "Better summary",
        slug: null,
        status: "draft",
        created_at: row.created_at,
      });
    }
  );

  it("merges three subjects across guide and objective revisions without losing content or duplicate tags", async () => {
    const user = await manager("lead-verifier");
    const author = await makeUser();
    const keep = await createSubject();
    const first = await createSubject();
    const second = await createSubject({ slug: null, status: "draft" });
    const unrelated = await createSubject();
    const guide = await createPublishedGuide({ authorId: author.userId });
    const guideDraft = await createGuideRevision(guide.guide.id, {
      author_id: author.userId,
      status: "draft",
    });
    const objective = await createPublishedObjective(author.userId, guide);
    const objectiveDraft = await createObjectiveRevision(
      objective.objective.id,
      { author_id: author.userId, status: "draft" }
    );
    for (const row of [keep, first, second, unrelated]) {
      await tagGuideRevision(guideDraft.id, row.id);
      await tagObjectiveRevision(objectiveDraft.id, row.id);
    }
    await tagGuideRevision(guide.revision.id, first.id);
    await tagObjectiveRevision(objective.revision.id, second.id);
    expect(
      (await manage(user.token, [keep.id, first.id, second.id])).status
    ).toBe(200);
    expect((await subject(first.id)).data).toBeNull();
    expect((await subject(second.id)).data).toBeNull();
    expect((await subject(keep.id)).data).toMatchObject({
      name: "Merged subject",
      slug: keep.slug,
      status: "published",
      created_at: keep.created_at,
    });
    for (const request of [
      admin
        .from("guide_revision_subjects")
        .select("subject_id")
        .eq("guide_revision_id", guideDraft.id),
      admin
        .from("objective_revision_subjects")
        .select("subject_id")
        .eq("objective_revision_id", objectiveDraft.id),
    ]) {
      const { data } = await request.throwOnError();
      expect(data.map((tag) => tag.subject_id).sort()).toEqual(
        [keep.id, unrelated.id].sort()
      );
    }
    for (const request of [
      admin
        .from("guide_revision_subjects")
        .select("subject_id")
        .eq("guide_revision_id", guide.revision.id),
      admin
        .from("objective_revision_subjects")
        .select("subject_id")
        .eq("objective_revision_id", objective.revision.id),
    ]) {
      const { data } = await request.throwOnError();
      expect(data.map((tag) => tag.subject_id)).toContain(keep.id);
    }
    const live = await admin
      .from("guides")
      .select("current_revision_id")
      .eq("id", guide.guide.id)
      .single()
      .throwOnError();
    expect(live.data.current_revision_id).toBe(guide.revision.id);
    const liveObjective = await admin
      .from("objectives")
      .select("current_revision_id")
      .eq("id", objective.objective.id)
      .single()
      .throwOnError();
    expect(liveObjective.data.current_revision_id).toBe(objective.revision.id);
  });

  it("rolls back stale selections and doesn't hide published subjects in a draft destination", async () => {
    const user = await manager();
    const published = await createSubject();
    const draft = await createSubject({ status: "draft", slug: null });
    expect(
      (await manage(user.token, [published.id, crypto.randomUUID()])).status
    ).toBe(409);
    expect((await manage(user.token, [draft.id, published.id])).status).toBe(
      400
    );
    expect((await subject(published.id)).data?.name).toBe(published.name);
    expect((await subject(draft.id)).data?.name).toBe(draft.name);
  });

  it("serializes overlapping merges without losing revision tags", async () => {
    const user = await manager();
    const first = await createSubject();
    const second = await createSubject();
    const shared = await createSubject();
    const guide = await createPublishedGuide({ authorId: user.userId });
    await tagGuideRevision(guide.revision.id, shared.id);

    const results = await Promise.all([
      manage(user.token, [first.id, shared.id], first.id, "First destination"),
      manage(
        user.token,
        [shared.id, second.id],
        second.id,
        "Second destination"
      ),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    const retained = results[0].status === 200 ? first : second;
    const untouched = results[0].status === 200 ? second : first;
    expect((await subject(shared.id)).data).toBeNull();
    expect((await subject(untouched.id)).data?.name).toBe(untouched.name);
    const { data } = await admin
      .from("guide_revision_subjects")
      .select("subject_id")
      .eq("guide_revision_id", guide.revision.id)
      .throwOnError();
    expect(data).toEqual([{ subject_id: retained.id }]);
  });

  it("keeps all-draft merges unpublished and accepts clearing a summary", async () => {
    const user = await manager();
    const first = await createSubject({ status: "draft", slug: null });
    const second = await createSubject({ status: "draft", slug: null });
    expect(
      (
        await manage(
          user.token,
          [first.id, second.id],
          first.id,
          "Draft merged",
          null
        )
      ).status
    ).toBe(200);
    expect((await subject(first.id)).data).toMatchObject({
      status: "draft",
      slug: null,
      summary: null,
    });
  });

  it("rejects malformed selections and invalid details without changing subjects", async () => {
    const user = await manager();
    const row = await createSubject();
    const base = {
      subject_ids: [row.id],
      target_id: row.id,
      name: "Valid name",
      summary: "",
    };
    for (const change of [
      { subject_ids: [] },
      { subject_ids: [row.id, row.id] },
      { target_id: crypto.randomUUID() },
      { subject_ids: ["bad-id"] },
      { name: "   " },
      { name: "a".repeat(51) },
      { summary: "a".repeat(501) },
      { subject_ids: Array.from({ length: 101 }, () => crypto.randomUUID()) },
    ]) {
      expect(
        (
          await app.request(
            `${path}/manage`,
            jsonAuth(user.token, "POST", { ...base, ...change }),
            env
          )
        ).status
      ).toBe(400);
    }
    expect((await subject(row.id)).data?.name).toBe(row.name);
  });

  it("filters literal text and creation dates, sorts before pagination, and returns filtered totals", async () => {
    const user = await manager();
    const prefix = crypto.randomUUID().slice(0, 8);
    for (const [suffix, date] of [
      ["B", "2026-10-02"],
      ["A", "2026-10-01"],
      ["C", "2026-10-03"],
    ]) {
      await createSubject({
        name: `${prefix} ${suffix}`,
        summary: "100% match_",
        created_at: `${date}T12:00:00Z`,
      });
    }
    const query = `name=${prefix}&sortBy=name&sortDirection=asc&limit=1&page=2`;
    const page = await app.request(`${path}?${query}`, auth(user.token), env);
    expect(await page.json()).toMatchObject({
      total: 3,
      data: [{ name: `${prefix} B` }],
    });
    const filtered = await app.request(
      `${path}?name=${prefix}&summary=${encodeURIComponent("% match_")}&date_created_from=2026-10-02T00:00:00Z&date_created_to=2026-10-03T00:00:00Z`,
      auth(user.token),
      env
    );
    expect(await filtered.json()).toMatchObject({
      total: 1,
      data: [{ name: `${prefix} B` }],
    });
    const beyond = await app.request(
      `${path}?name=${prefix}&page=10&limit=1`,
      auth(user.token),
      env
    );
    expect(await beyond.json()).toEqual({ total: 3, data: [] });
  });
});
