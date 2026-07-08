import { describe, it, expect } from "vitest";
import app from "../src/index";
import { env, makeUser } from "./helpers";
import { expectToMatchSpec } from "./openapi";

describe("POST /media/upload", () => {
  it("401s without a token", async () => {
    const res = await app.request("/media/upload", { method: "POST" }, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/media/upload");
  });

  // Contract-first: 501 stub. Asserts the documented stored-asset shape.
  it("stores an uploaded file and returns its url", async () => {
    const { token } = await makeUser();
    const form = new FormData();
    form.append(
      "file",
      new Blob(["fake-png-bytes"], { type: "image/png" }),
      "test.png"
    );

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
});
