import { describe, it, expect } from "vitest";
import app from "../src/index";
import { env, makeUser } from "./helpers";
import { expectToMatchSpec } from "./openapi";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
} from "./factories/guides";

describe("POST /media/upload", () => {
  it("401s without a token", async () => {
    const res = await app.request("/media/upload", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/media/upload");
  });

  it("stores an uploaded file and returns its url", async () => {
    const { token, userId } = await makeUser();
    // The RLS link policy requires a draft revision authored by the uploader.
    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: userId });
    const revision = await createGuideRevision(guide.id, {
      status: "draft",
      author_id: userId,
    });

    const form = new FormData();
    form.append(
      "file",
      new Blob(["fake-png-bytes"], { type: "image/png" }),
      "test.png"
    );
    form.append("revision_id", revision.id);

    const res = await app.request(
      "/media/upload",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
      env
    );

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", "/media/upload");
  });

  it("404s when the revision does not exist", async () => {
    const { token } = await makeUser();
    const form = new FormData();
    form.append(
      "file",
      new Blob(["fake-png-bytes"], { type: "image/png" }),
      "test.png"
    );
    form.append("revision_id", crypto.randomUUID());

    const res = await app.request(
      "/media/upload",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/media/upload");
  });
});
