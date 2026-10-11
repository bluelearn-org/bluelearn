import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, auth, env, makeUser } from "./helpers";
import { grantRole } from "./factories/identity";
import {
  createPanelMember,
  createReviewCase,
  createReviewPanel,
} from "./factories/reviews";

// The old `.in(ids)` filter hit the gateway URL limit at 200-250 users (#482).
const USERS_PAST_URL_LIMIT = 300;

async function seedUsersUpTo(total: number) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw error;

  let missing = total - (count ?? 0);
  while (missing > 0) {
    const batch = Math.min(missing, 25);
    await Promise.all(
      Array.from({ length: batch }, async () => {
        const { error } = await admin.auth.admin.createUser({
          email: `test-${crypto.randomUUID()}@example.com`,
          email_confirm: true,
        });
        if (error) throw error;
      })
    );
    missing -= batch;
  }
}

// Each test names its members under a fresh prefix and searches by it, so
// the rows other tests leave in the database never reach its pages.
function uniqueUsernamePrefix() {
  return `dash-${crypto.randomUUID().slice(0, 8)}`;
}

async function createMember(username: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `test-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  return data.user.id;
}

async function setStatus(userId: string, status: "suspended" | null) {
  const request =
    status === null
      ? admin.from("user_statuses").delete().eq("user_id", userId)
      : admin.from("user_statuses").update({ status }).eq("user_id", userId);
  const { error } = await request;
  if (error) throw error;
}

let adminToken: string;

beforeAll(async () => {
  const { token, userId } = await makeUser();
  await grantRole(userId, "admin");
  adminToken = token;
});

type Row = { username?: string; status?: string; roles?: string[] };

async function requestTablePage(
  path: string,
  query: Record<string, string | Array<string>>,
  token = adminToken
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value].flat()) params.append(key, item);
  }

  const res = await app.request(`${path}?${params}`, auth(token), env);
  const body = (await res.json()) as { data: Array<Row>; total: number };

  return {
    status: res.status,
    total: body.total,
    names: body.data?.map((row) => row.username),
    rows: body.data,
  };
}

describe("dashboard tables", () => {
  beforeAll(() => seedUsersUpTo(USERS_PAST_URL_LIMIT), 60_000);

  it.each(["/dashboard/members", "/dashboard/roles", "/dashboard/assignments"])(
    "GET %s returns 200 with 300 or more users",
    async (path) => {
      const res = await app.request(path, auth(adminToken), env);

      expect(res.status).toBe(200);
    }
  );
});

describe("GET /dashboard/members", () => {
  it("returns matching members across pages, including an empty page past the end", async () => {
    const prefix = uniqueUsernamePrefix();
    for (const name of ["a", "b", "c"]) await createMember(`${prefix}-${name}`);
    const query = { username: prefix, sortBy: "username", limit: "2" };

    const first = await requestTablePage("/dashboard/members", {
      ...query,
      page: "1",
    });
    const second = await requestTablePage("/dashboard/members", {
      ...query,
      page: "2",
    });
    const past = await requestTablePage("/dashboard/members", {
      ...query,
      page: "3",
    });

    expect(first.names).toEqual([`${prefix}-a`, `${prefix}-b`]);
    expect(second.names).toEqual([`${prefix}-c`]);
    expect(past.status).toBe(200);
    expect(past.names).toEqual([]);
    expect([first.total, second.total, past.total]).toEqual([3, 3, 3]);
  });

  it("includes statusless members when none is selected", async () => {
    const prefix = uniqueUsernamePrefix();
    await createMember(`${prefix}-active`);
    await setStatus(await createMember(`${prefix}-gone`), "suspended");
    await setStatus(await createMember(`${prefix}-none`), null);

    const memberNamesByStatus = async (status: Array<string>) =>
      (
        await requestTablePage("/dashboard/members", {
          username: prefix,
          status,
          sortBy: "username",
        })
      ).names;

    expect(await memberNamesByStatus(["none"])).toEqual([`${prefix}-none`]);
    expect(await memberNamesByStatus(["suspended", "none"])).toEqual([
      `${prefix}-gone`,
      `${prefix}-none`,
    ]);
    expect(await memberNamesByStatus(["active"])).toEqual([`${prefix}-active`]);
  });

  it("searches case-insensitively and treats LIKE wildcards as text", async () => {
    const prefix = uniqueUsernamePrefix();
    await createMember(`${prefix}-x_y`);
    await createMember(`${prefix}-xay`);

    const search = async (username: string) =>
      (
        await requestTablePage("/dashboard/members", {
          username,
          sortBy: "username",
        })
      ).names;

    expect(await search(`${prefix}-x_y`)).toEqual([`${prefix}-x_y`]);
    expect(await search(`${prefix}-X`.toUpperCase())).toEqual([
      `${prefix}-x_y`,
      `${prefix}-xay`,
    ]);
  });

  it("finds a member without a display name by the username shown instead", async () => {
    const prefix = uniqueUsernamePrefix();
    await createMember(`${prefix}-plain`);

    const page = await requestTablePage("/dashboard/members", {
      display_name: prefix,
    });

    expect(page.names).toEqual([`${prefix}-plain`]);
  });

  it("filters creation time with an inclusive start and an exclusive end", async () => {
    const prefix = uniqueUsernamePrefix();
    const start = Date.parse("2020-01-01T00:00:00Z");
    const hours = [0, 1, 2];
    for (const hour of hours) {
      const id = await createMember(`${prefix}-${hour}`);
      const { error } = await admin
        .from("profiles")
        .update({ created_at: new Date(start + hour * 3600000).toISOString() })
        .eq("id", id);
      if (error) throw error;
    }

    const page = await requestTablePage("/dashboard/members", {
      username: prefix,
      date_created_from: new Date(start + 3600000).toISOString(),
      date_created_to: new Date(start + 2 * 3600000).toISOString(),
    });

    expect(page.names).toEqual([`${prefix}-1`]);
  });

  it("shows a non-admin every member but only their own status", async () => {
    const prefix = uniqueUsernamePrefix();
    await createMember(`${prefix}-other`);
    const plain = await makeUser();
    const { error } = await admin
      .from("profiles")
      .update({ username: `${prefix}-me` })
      .eq("id", plain.userId);
    if (error) throw error;

    const page = await requestTablePage(
      "/dashboard/members",
      { username: prefix, sortBy: "username" },
      plain.token
    );

    expect(page.rows.map((row) => [row.username, row.status])).toEqual([
      [`${prefix}-me`, "active"],
      [`${prefix}-other`, undefined],
    ]);
  });

  it.each([
    ["an unknown sort", { sortBy: "password" }],
    ["a page size above the allowed limit", { limit: "101" }],
    ["an unknown status", { status: "banned" }],
    ["a date that is not an instant", { date_created_from: "yesterday" }],
  ])("refuses %s", async (_name, query) => {
    const page = await requestTablePage("/dashboard/members", query);

    expect(page.status).toBe(400);
  });
});

describe("GET /dashboard/roles", () => {
  it("combines selected roles with members who have no roles", async () => {
    const prefix = uniqueUsernamePrefix();
    await grantRole(await createMember(`${prefix}-a`), "curator");
    const both = await createMember(`${prefix}-b`);
    await grantRole(both, "curator");
    await grantRole(both, "verifier");
    await createMember(`${prefix}-c`);

    const membersByRoles = async (roles: Array<string>) =>
      (
        await requestTablePage("/dashboard/roles", {
          username: prefix,
          roles,
          sortBy: "username",
        })
      ).rows.map((row) => [row.username, row.roles]);

    expect(await membersByRoles(["verifier"])).toEqual([
      [`${prefix}-b`, ["verifier", "curator"]],
    ]);
    expect(await membersByRoles(["none"])).toEqual([[`${prefix}-c`, []]]);
    expect(await membersByRoles(["verifier", "none"])).toEqual([
      [`${prefix}-b`, ["verifier", "curator"]],
      [`${prefix}-c`, []],
    ]);
  });
});

describe("GET /dashboard/assignments", () => {
  it("filters seats by time left and sorts seats without a deadline last", async () => {
    const prefix = uniqueUsernamePrefix();
    const author = await createMember(`${prefix}-author`);
    const review = await createReviewCase(author);
    const panel = await createReviewPanel(review.id, { target_seat_count: 3 });
    const now = Date.now();
    const deadlines: Record<string, number | null> = {
      late: now - 3600000,
      soon: now + 2 * 3600000,
      open: null,
    };
    for (const [name, deadline] of Object.entries(deadlines)) {
      const seat = await createPanelMember(
        panel.id,
        await createMember(`${prefix}-${name}`)
      );
      const { error } = await admin
        .from("panel_members")
        .update({
          expires_at:
            deadline === null ? null : new Date(deadline).toISOString(),
        })
        .eq("id", seat.id);
      if (error) throw error;
    }

    const seats = async (query: Record<string, string>) =>
      (
        await requestTablePage("/dashboard/assignments", {
          username: prefix,
          ...query,
        })
      ).names;

    expect(await seats({ time_left_to: new Date(now).toISOString() })).toEqual([
      `${prefix}-late`,
    ]);
    expect(
      await seats({
        time_left_from: new Date(now).toISOString(),
        time_left_to: new Date(now + 3 * 3600000).toISOString(),
      })
    ).toEqual([`${prefix}-soon`]);
    expect(await seats({ sortBy: "time_left", sortDirection: "desc" })).toEqual(
      [`${prefix}-soon`, `${prefix}-late`, `${prefix}-open`]
    );
    expect(await seats({ sortBy: "time_left", sortDirection: "asc" })).toEqual([
      `${prefix}-late`,
      `${prefix}-soon`,
      `${prefix}-open`,
    ]);
  });

  it("lists the newest assignments first until a column sort is picked", async () => {
    const prefix = uniqueUsernamePrefix();
    const author = await createMember(`${prefix}-author`);
    const now = Date.now();
    const created: Record<string, number> = {
      old: now - 2 * 86400000,
      mid: now - 86400000,
      new: now,
    };
    for (const [name, createdAt] of Object.entries(created)) {
      const review = await createReviewCase(author, {
        created_at: new Date(createdAt).toISOString(),
      });
      const panel = await createReviewPanel(review.id, {
        target_seat_count: 3,
      });
      await createPanelMember(
        panel.id,
        await createMember(`${prefix}-${name}`)
      );
    }

    const seats = async (query: Record<string, string> = {}) =>
      (
        await requestTablePage("/dashboard/assignments", {
          username: prefix,
          ...query,
        })
      ).names;

    expect(await seats()).toEqual([
      `${prefix}-new`,
      `${prefix}-mid`,
      `${prefix}-old`,
    ]);
    expect(
      await seats({ sortBy: "date_created", sortDirection: "asc" })
    ).toEqual([`${prefix}-old`, `${prefix}-mid`, `${prefix}-new`]);
  });
});
