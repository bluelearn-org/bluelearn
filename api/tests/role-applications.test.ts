import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { getUsername, grantRole, suspendProfile } from "./factories/identity";
import { expectToMatchSpec } from "./openapi";

type Application = {
  id: string;
  role: string;
  status: string;
  statement: string | null;
  created_at: string;
  decided_at: string | null;
};

type TableRow = {
  user_id: string;
  username: string;
  role: string;
  status: string;
  statement: string | null;
  decided_by: string | null;
};

const MINE = "/me/role-applications";
const TABLE = "/dashboard/role-applications";

function apply(token: string, body: unknown) {
  return app.request(MINE, jsonAuth(token, "POST", body), env);
}

async function applied(token: string, role: string) {
  const res = await apply(token, { role });
  expect(res.status).toBe(201);
  return ((await res.json()) as { application: Application }).application;
}

function decide(token: string, id: string, status: string) {
  return app.request(
    `${TABLE}/${id}`,
    jsonAuth(token, "PATCH", { status }),
    env
  );
}

async function myApplications(token: string) {
  const res = await app.request(MINE, auth(token), env);
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", MINE);
  return ((await res.json()) as { applications: Application[] }).applications;
}

async function tablePage(token: string, query: Record<string, string>) {
  const res = await app.request(
    `${TABLE}?${new URLSearchParams(query)}`,
    auth(token),
    env
  );
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", TABLE);
  return (await res.json()) as { data: TableRow[]; total: number };
}

async function rolesOf(userId: string) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return data.map((row) => row.role);
}

let adminToken: string;
let adminUsername: string;

beforeAll(async () => {
  const { token, userId } = await makeUser();
  await grantRole(userId, "admin");
  adminToken = token;
  adminUsername = await getUsername(userId);
});

describe("POST /me/role-applications", () => {
  it("401s without a token", async () => {
    const res = await app.request(MINE, { method: "POST" }, env);

    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", MINE);
  });

  it("files a pending application the caller can read back", async () => {
    const { token } = await makeUser();

    const res = await apply(token, {
      role: "verifier",
      statement: "  I read closely.  ",
    });

    expect(res.status).toBe(201);
    await expectToMatchSpec(res, "POST", MINE);
    const { application } = (await res.json()) as { application: Application };
    expect(application).toMatchObject({
      role: "verifier",
      status: "pending",
      statement: "I read closely.",
      decided_at: null,
    });
    expect(await myApplications(token)).toEqual([application]);
  });

  it("allows one open application per role, newest listed first", async () => {
    const { token } = await makeUser();

    const verifier = await applied(token, "verifier");
    const moderator = await applied(token, "moderator");

    expect((await myApplications(token)).map((a) => a.id)).toEqual([
      moderator.id,
      verifier.id,
    ]);
  });

  it("409s a second open application for the same role", async () => {
    const { token } = await makeUser();
    await applied(token, "moderator");

    const res = await apply(token, { role: "moderator" });

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "POST", MINE);
  });

  it("409s a role the caller already holds", async () => {
    const { token, userId } = await makeUser();
    await grantRole(userId, "verifier");

    const res = await apply(token, { role: "verifier" });

    expect(res.status).toBe(409);
    await expectToMatchSpec(res, "POST", MINE);
  });

  it("403s a suspended account", async () => {
    const { token, userId } = await makeUser();
    await suspendProfile(userId);

    const res = await apply(token, { role: "verifier" });

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "POST", MINE);
  });

  it.each(["admin", "curator", "official", "learner"])(
    "400s an application for %s, which is not open to application",
    async (role) => {
      const { token } = await makeUser();

      const res = await apply(token, { role });

      expect(res.status).toBe(400);
      await expectToMatchSpec(res, "POST", MINE);
    }
  );

  it("400s a blank statement rather than storing it", async () => {
    const { token } = await makeUser();

    const res = await apply(token, { role: "verifier", statement: "   " });

    expect(res.status).toBe(400);
  });
});

describe("GET /dashboard/role-applications", () => {
  it("shows an admin every application with the applicant's username", async () => {
    const applicant = await makeUser();
    const username = await getUsername(applicant.userId);
    const res = await apply(applicant.token, {
      role: "verifier",
      statement: "Pick me",
    });
    expect(res.status).toBe(201);

    const page = await tablePage(adminToken, { username });

    expect(page.total).toBe(1);
    expect(page.data[0]).toMatchObject({
      user_id: applicant.userId,
      username,
      role: "verifier",
      status: "pending",
      statement: "Pick me",
      decided_by: null,
    });
  });

  it("filters by status", async () => {
    const applicant = await makeUser();
    const username = await getUsername(applicant.userId);
    const verifier = await applied(applicant.token, "verifier");
    await applied(applicant.token, "moderator");
    expect((await decide(adminToken, verifier.id, "rejected")).status).toBe(
      200
    );

    const pending = await tablePage(adminToken, {
      username,
      status: "pending",
    });
    const rejected = await tablePage(adminToken, {
      username,
      status: "rejected",
    });

    expect(pending.data.map((row) => row.role)).toEqual(["moderator"]);
    expect(rejected.data.map((row) => row.role)).toEqual(["verifier"]);
  });

  it("shows a member only their own applications", async () => {
    const other = await makeUser();
    await applied(other.token, "verifier");
    const mine = await makeUser();
    await applied(mine.token, "moderator");

    const page = await tablePage(mine.token, {});

    expect(page.total).toBe(1);
    expect(page.data[0].user_id).toBe(mine.userId);
  });
});

describe("PATCH /dashboard/role-applications/{id}", () => {
  it("403s a member who is not an admin", async () => {
    const applicant = await makeUser();
    const application = await applied(applicant.token, "verifier");

    const res = await decide(applicant.token, application.id, "approved");

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
    expect(await rolesOf(applicant.userId)).toEqual([]);
  });

  it("approves and grants the role in one step", async () => {
    const applicant = await makeUser();
    const username = await getUsername(applicant.userId);
    const application = await applied(applicant.token, "verifier");

    const res = await decide(adminToken, application.id, "approved");

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
    const decided = ((await res.json()) as { application: Application })
      .application;
    expect(decided.id).toBe(application.id);
    expect(decided.status).toBe("approved");
    expect(decided.decided_at).not.toBeNull();
    expect(await rolesOf(applicant.userId)).toEqual(["verifier"]);
    expect((await myApplications(applicant.token))[0]?.status).toBe("approved");

    const page = await tablePage(adminToken, { username });
    expect(page.data[0]).toMatchObject({
      status: "approved",
      decided_by: adminUsername,
    });
  });

  it("rejects without granting anything", async () => {
    const applicant = await makeUser();
    const application = await applied(applicant.token, "moderator");

    const res = await decide(adminToken, application.id, "rejected");

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
    expect(await rolesOf(applicant.userId)).toEqual([]);
    expect((await myApplications(applicant.token))[0]?.status).toBe("rejected");
  });

  it("lets a rejected member apply for the same role again", async () => {
    const applicant = await makeUser();
    const first = await applied(applicant.token, "moderator");
    await decide(adminToken, first.id, "rejected");

    const res = await apply(applicant.token, { role: "moderator" });

    expect(res.status).toBe(201);
  });

  it("404s an application that was already decided", async () => {
    const applicant = await makeUser();
    const application = await applied(applicant.token, "verifier");
    await decide(adminToken, application.id, "approved");

    const res = await decide(adminToken, application.id, "rejected");

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
  });

  it("404s an unknown application", async () => {
    const res = await decide(adminToken, crypto.randomUUID(), "approved");

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
  });

  it("400s a decision that is neither approved nor rejected", async () => {
    const applicant = await makeUser();
    const application = await applied(applicant.token, "verifier");

    const res = await decide(adminToken, application.id, "pending");

    expect(res.status).toBe(400);
    await expectToMatchSpec(res, "PATCH", `${TABLE}/{id}`);
  });
});

describe("granting a role directly", () => {
  it("settles a pending application for that role", async () => {
    const applicant = await makeUser();
    await applied(applicant.token, "moderator");

    const granted = await app.request(
      `/dashboard/${applicant.userId}/role/moderator`,
      { method: "POST", ...auth(adminToken) },
      env
    );

    expect(granted.status).toBe(200);
    const [application] = await myApplications(applicant.token);
    expect(application.status).toBe("approved");
    expect(application.decided_at).not.toBeNull();
  });
});
