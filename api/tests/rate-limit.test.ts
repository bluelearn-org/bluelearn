import { describe, it, expect } from "vitest";
import app from "../src/index";
import { env, jsonAuth, makeUser } from "./helpers";
import { expectToMatchSpec } from "./openapi";

function guideBody() {
  return {
    knowledge_type: "theoretical" as const,
    title: "Rate Limit Test Guide",
    body: "Body content.",
  };
}

describe("POST /guides rate limit", () => {
  it("allows up to 15 guide creations per user per day", async () => {
    const { token } = await makeUser();

    for (let i = 0; i < 15; i++) {
      const res = await app.request(
        "/guides",
        jsonAuth(token, "POST", guideBody()),
        env
      );
      expect(res.status).toBe(201);
    }
  });

  it("returns 429 on the 16th guide creation within the same day", async () => {
    const { token } = await makeUser();

    for (let i = 0; i < 15; i++) {
      await app.request("/guides", jsonAuth(token, "POST", guideBody()), env);
    }

    const res = await app.request(
      "/guides",
      jsonAuth(token, "POST", guideBody()),
      env
    );

    expect(res.status).toBe(429);
    await expectToMatchSpec(res, "POST", "/guides");
    expect(res.headers.get("Retry-After")).not.toBeNull();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Rate limit exceeded");
  });

  it("does not share counters between different users", async () => {
    const first = await makeUser();
    const second = await makeUser();

    for (let i = 0; i < 15; i++) {
      await app.request(
        "/guides",
        jsonAuth(first.token, "POST", guideBody()),
        env
      );
    }

    const res = await app.request(
      "/guides",
      jsonAuth(second.token, "POST", guideBody()),
      env
    );

    expect(res.status).toBe(201);
  });

  it("returns 401 (not 429) for unauthenticated requests", async () => {
    const res = await app.request("/guides", { method: "POST" }, env);
    expect(res.status).toBe(401);
  });
});
