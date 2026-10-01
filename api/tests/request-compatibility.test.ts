import { afterEach, describe, expect, it } from "vitest";
import {
  createGuideSchema,
  updateRevisionSchema,
  type Guide,
} from "@bluelearn/schemas";
import app from "../src/index";
import { admin, env, jsonAuth, makeUser } from "./helpers";
import { createPublishedGuide } from "./factories/guides";
import { createTodo } from "./factories/graph";
import { expectToMatchSpec } from "./openapi";

const request = { title: "Functions", summary: "How functions work" };

describe("request field compatibility", () => {
  const createdBases: string[] = [];

  afterEach(async () => {
    if (createdBases.length > 0) {
      await admin
        .from("guide_bases")
        .delete()
        .in("id", createdBases)
        .throwOnError();
      createdBases.length = 0;
    }
  });

  it("normalizes legacy fields without returning duplicate names", () => {
    const claim = crypto.randomUUID();
    const parsed = createGuideSchema.parse({
      todoPrereqs: [request],
      todoClaims: [claim],
    });
    expect(parsed.requests).toEqual([request]);
    expect(parsed.requestClaims).toEqual([claim]);
    expect(parsed).not.toHaveProperty("todoPrereqs");
    expect(parsed).not.toHaveProperty("todoClaims");
  });

  it("prefers current fields, including explicitly empty arrays", () => {
    const parsed = createGuideSchema.parse({
      requests: [],
      requestClaims: [],
      todoPrereqs: [request],
      todoClaims: [crypto.randomUUID()],
    });
    expect(parsed.requests).toEqual([]);
    expect(parsed.requestClaims).toEqual([]);
    expect(
      updateRevisionSchema.parse({ requests: [], todoPrereqs: [request] })
    ).toEqual({ requests: [] });
  });

  it("keeps missing request fields out of partial updates", () => {
    expect(updateRevisionSchema.parse({ title: "Functions" })).toEqual({
      title: "Functions",
    });
    expect(updateRevisionSchema.safeParse({}).success).toBe(false);
    expect(updateRevisionSchema.parse({ todoPrereqs: [] })).toEqual({
      requests: [],
    });
    expect(createGuideSchema.parse({}).requests).toEqual([]);
    expect(createGuideSchema.parse({}).requestClaims).toEqual([]);
  });

  it.each([
    { todoPrereqs: [{ title: "Functions" }] },
    { todoPrereqs: [{ title: "", summary: "Missing title" }] },
    { todoClaims: ["not-a-uuid"] },
  ])("validates legacy input instead of silently dropping it: %j", (input) => {
    expect(createGuideSchema.safeParse(input).success).toBe(false);
  });

  it("persists requests and claims sent by an older client", async () => {
    const { token } = await makeUser();
    const dependent = await createPublishedGuide();
    createdBases.push(dependent.base.id);
    const claim = await createTodo(dependent.base.id);
    const res = await app.request(
      "/guides",
      jsonAuth(token, "POST", {
        title: "Legacy client draft",
        todoPrereqs: [request],
        todoClaims: [claim.id],
      }),
      env
    );
    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/guides");
    const { revision_id } = (await res.json()) as { revision_id: string };
    const { data: revision } = await admin
      .from("guide_revisions")
      .select("guide:guides!guide_revisions_guide_id_fkey(guide_base_id)")
      .eq("id", revision_id)
      .single()
      .throwOnError();
    const baseId = revision!.guide!.guide_base_id;
    createdBases.push(baseId);
    const { data: requests } = await admin
      .from("requests")
      .select("title, summary")
      .eq("dependent_guide_base_id", baseId)
      .throwOnError();
    expect(requests).toEqual([request]);
    const { data: claims } = await admin
      .from("request_claims")
      .select("todo_id")
      .eq("guide_base_id", baseId)
      .throwOnError();
    expect(claims).toEqual([{ todo_id: claim.id }]);

    const updated = { title: "Variables", summary: "How variables work" };
    const patch = await app.request(
      `/guide-revisions/${revision_id}`,
      jsonAuth(token, "PATCH", { todoPrereqs: [updated] }),
      env
    );
    expect(patch.status).toBe(200);
    await expectToMatchSpec(patch, "PATCH", "/guide-revisions/{id}");
    const { data: saved } = await admin
      .from("requests")
      .select("title, summary")
      .eq("dependent_guide_base_id", baseId)
      .throwOnError();
    expect(saved).toEqual([updated]);
  });

  it("returns the same open requests under both response names", async () => {
    const guide = await createPublishedGuide();
    createdBases.push(guide.base.id);
    const todo = await createTodo(guide.base.id, request);
    const res = await app.request(`/guides/${guide.base.slug}`, {}, env);
    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guides/{slug}");
    const body = (await res.json()) as Guide;
    expect(body.requests).toEqual([{ id: todo.id, ...request }]);
    expect(body.todo_prerequisites).toEqual(body.requests);
  });
});
