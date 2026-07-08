import { describe, it, expect } from "vitest";
import app from "../src/index";
import { auth, env, jsonAuth, makeUser } from "./helpers";
import { getUsername, grantRole, suspendProfile } from "./factories/identity";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
} from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

describe("GET /me", () => {
  it("401s without a token", async () => {
    const res = await app.request("/me", {}, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "GET", "/me");
  });

  it("returns the caller's profile and roles", async () => {
    const { token, userId } = await makeUser();
    await grantRole(userId, "verifier");

    const res = await app.request("/me", auth(token), env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/me");
    const body = (await res.json()) as {
      profile: { id: string };
      roles: string[];
    };
    expect(body.profile.id).toBe(userId);
    expect(body.roles).toContain("verifier");
  });
});

describe("GET /me/drafts", () => {
  it("401s without a token", async () => {
    const res = await app.request("/me/drafts", {}, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "GET", "/me/drafts");
  });

  it("lists the caller's drafts but not another author's", async () => {
    const { token, userId } = await makeUser();
    const other = await makeUser();

    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: userId });
    const mine = await createGuideRevision(guide.id, {
      author_id: userId,
      status: "draft",
      title: "My Draft",
    });
    const otherGuide = await createGuide(base.id, { author_id: other.userId });
    const theirs = await createGuideRevision(otherGuide.id, {
      author_id: other.userId,
      status: "draft",
    });

    const res = await app.request("/me/drafts", auth(token), env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/me/drafts");
    const body = (await res.json()) as {
      guide_drafts: Array<{ revision_id: string; title: string }>;
    };
    const ids = body.guide_drafts.map((d) => d.revision_id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });
});

describe("PATCH /me", () => {
  it("updates the caller's profile", async () => {
    const { token } = await makeUser();

    const res = await app.request(
      "/me",
      jsonAuth(token, "PATCH", { display_name: "Tony" }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/me");
    const body = (await res.json()) as {
      profile: { display_name: string | null };
    };
    expect(body.profile.display_name).toBe("Tony");
  });

  it("409s when the username is already taken", async () => {
    const { userId: takenId } = await makeUser();
    const taken = await getUsername(takenId);
    const { token } = await makeUser();

    const res = await app.request(
      "/me",
      jsonAuth(token, "PATCH", { username: taken }),
      env
    );

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "PATCH", "/me");
  });
});

describe("GET /profiles/{username}", () => {
  it("returns a public profile without internal fields", async () => {
    const { userId } = await makeUser();
    await grantRole(userId, "verifier");
    const username = await getUsername(userId);

    const res = await app.request(`/profiles/${username}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/profiles/{username}");
    const body = (await res.json()) as {
      profile: { username: string };
      roles: string[];
    };
    expect(body.profile.username).toBe(username);
    expect(body.roles).toContain("verifier");
  });

  it("hides suspended profiles", async () => {
    const { userId } = await makeUser();
    const username = await getUsername(userId);
    await suspendProfile(userId);

    const res = await app.request(`/profiles/${username}`, {}, env);

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/profiles/{username}");
  });
});
