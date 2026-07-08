import { describe, it, expect } from "vitest";
import app from "../src/index";
import { env, jsonAuth, makeUser } from "./helpers";
import { createSubject, tagGuide } from "./factories/subjects";
import { createPublishedGuide } from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

describe("GET /subjects", () => {
  it("lists subjects", async () => {
    const subject = await createSubject();

    const res = await app.request("/subjects", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects");
    const body = (await res.json()) as { subjects: Array<{ id: string }> };
    expect(body.subjects.map((s) => s.id)).toContain(subject.id);
  });
});

describe("POST /subjects", () => {
  it("401s without a token", async () => {
    const res = await app.request("/subjects", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/subjects");
  });

  it("creates a subject with a slug derived from its name", async () => {
    const { token } = await makeUser();
    // subjectNameSchema caps names at 35 chars, so keep the unique part short.
    const name = `Algebra ${crypto.randomUUID().slice(0, 8)}`;

    const res = await app.request(
      "/subjects",
      jsonAuth(token, "POST", { name }),
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/subjects");
    const body = (await res.json()) as {
      subject: { slug: string; name: string };
    };
    expect(body.subject.name).toBe(name);
    expect(body.subject.slug).toBe(name.toLowerCase().replaceAll(" ", "-"));
  });

  it("409s on a duplicate subject", async () => {
    const { token } = await makeUser();
    const subject = await createSubject();

    const res = await app.request(
      "/subjects",
      jsonAuth(token, "POST", { name: subject.name }),
      env
    );

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "POST", "/subjects");
  });
});

describe("GET /subjects/{slug}", () => {
  it("returns subject metadata", async () => {
    const subject = await createSubject();

    const res = await app.request(`/subjects/${subject.slug}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}");
    const body = (await res.json()) as { subject: { id: string } };
    expect(body.subject.id).toBe(subject.id);
  });
});

describe("GET /subjects/{slug}/guides", () => {
  it("lists tagged guides only", async () => {
    const subject = await createSubject();
    const tagged = await createPublishedGuide({ summary: "Tagged" });
    const untagged = await createPublishedGuide();
    await tagGuide(tagged.base.id, subject.id);

    const res = await app.request(`/subjects/${subject.slug}/guides`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/guides");
    const body = (await res.json()) as {
      guides: Array<{ id: string; summary: string | null }>;
    };
    const ids = body.guides.map((g) => g.id);
    expect(ids).toContain(tagged.base.id);
    expect(ids).not.toContain(untagged.base.id);
    expect(body.guides.find((g) => g.id === tagged.base.id)?.summary).toBe(
      "Tagged"
    );
  });
});
