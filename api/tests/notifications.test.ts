import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import app from "../src/index";
import type { Database } from "../src/database.types";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import {
  createGuide,
  createGuideBase,
  createGuideRevision,
  createPublishedGuide,
  createVote,
} from "./factories/guides";
import {
  createGuideReviewCase,
  createPanelMember,
  createReviewCase,
  createReviewPanel,
} from "./factories/reviews";
import { expectToMatchSpec } from "./openapi";

type ListBody = {
  notifications: Array<{
    id: string;
    type: string;
    category: string;
    actor: { id: string; username: string } | null;
    count: number;
    data: Record<string, unknown>;
    read_at: string | null;
  }>;
  has_more: boolean;
};

async function list(token: string, query = "") {
  const res = await app.request(`/notifications${query}`, auth(token), env);
  expect(res.status).toBe(200);
  return (await res.json()) as ListBody;
}

async function unreadCount(token: string) {
  const res = await app.request(
    "/notifications/unread-count",
    auth(token),
    env
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { count: number }).count;
}

// A guide revision by `authorId` under review by a one-seat panel. The
// panelist's decision closes the case through close_review_panel.
async function seedCaseForAuthor(authorId: string, title: string) {
  const panelist = await makeUser();
  const base = await createGuideBase();
  const guide = await createGuide(base.id);
  const revision = await createGuideRevision(guide.id, {
    title,
    author_id: authorId,
  });
  const reviewCase = await createReviewCase(authorId, {
    case_type: "guide_publish",
    status: "in_review",
  });
  const panel = await createReviewPanel(reviewCase.id, {
    target_seat_count: 1,
  });
  await createPanelMember(panel.id, panelist.userId);
  await createGuideReviewCase(reviewCase.id, revision.id);
  return { reviewCase, panelist };
}

async function decide(
  token: string,
  caseId: string,
  decision: "approved" | "rejected"
) {
  const res = await app.request(
    `/reviews/cases/${caseId}/decisions`,
    jsonAuth(
      token,
      "POST",
      decision === "approved"
        ? { decision }
        : { decision, notes: "Missing steps.", reasons: ["clarity_issue"] }
    ),
    env
  );
  expect(res.status).toBe(200);
}

// A client that acts as the user directly against PostgREST, the way a
// hostile browser could, without the API in between.
function userClient(token: string) {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

describe("guide_review_decision", () => {
  it("tells the revision author when the panel approves", async () => {
    const author = await makeUser();
    const { reviewCase, panelist } = await seedCaseForAuthor(
      author.userId,
      "How to speed"
    );

    await decide(panelist.token, reviewCase.id, "approved");

    const body = await list(author.token);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]).toMatchObject({
      type: "guide_review_decision",
      category: "guide_statuses",
      actor: null,
      count: 1,
      read_at: null,
      data: {
        case_id: reviewCase.id,
        outcome: "approved",
        title: "How to speed",
      },
    });
  });

  it("tells the author about a rejection too", async () => {
    const author = await makeUser();
    const { reviewCase, panelist } = await seedCaseForAuthor(
      author.userId,
      "Topology"
    );

    await decide(panelist.token, reviewCase.id, "rejected");

    const body = await list(author.token);
    expect(body.notifications.map((n) => n.data.outcome)).toEqual(["rejected"]);
  });

  it("does not notify the panelist who decided", async () => {
    const author = await makeUser();
    const { reviewCase, panelist } = await seedCaseForAuthor(
      author.userId,
      "Topology"
    );

    await decide(panelist.token, reviewCase.id, "approved");

    expect((await list(panelist.token)).notifications).toEqual([]);
  });

  it("stays quiet while the case is only moving into review", async () => {
    const author = await makeUser();
    const { reviewCase } = await seedCaseForAuthor(author.userId, "Topology");
    await admin
      .from("review_cases")
      .update({ status: "pending" })
      .eq("id", reviewCase.id)
      .throwOnError();
    await admin
      .from("review_cases")
      .update({ status: "in_review" })
      .eq("id", reviewCase.id)
      .throwOnError();

    expect(await unreadCount(author.token)).toBe(0);
  });
});

describe("guide_upvotes", () => {
  it("groups upvotes on one guide into one unread row", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({
      authorId: author.userId,
      title: "Sorting",
    });
    const first = await makeUser();
    const second = await makeUser();

    await createVote(first.userId, guide.id);
    await createVote(second.userId, guide.id);

    const body = await list(author.token);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]).toMatchObject({
      type: "guide_upvotes",
      count: 2,
      actor: { id: second.userId },
      data: { guide_id: guide.id, title: "Sorting", variant_slug: "main" },
    });
  });

  it("keeps separate rows for separate guides", async () => {
    const author = await makeUser();
    const one = await createPublishedGuide({ authorId: author.userId });
    const two = await createPublishedGuide({ authorId: author.userId });
    const voter = await makeUser();

    await createVote(voter.userId, one.guide.id);
    await createVote(voter.userId, two.guide.id);

    expect(await unreadCount(author.token)).toBe(2);
  });

  it("starts a new row after the author reads the group", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const [read] = (await list(author.token)).notifications;

    await app.request(
      `/notifications/${read.id}/read`,
      jsonAuth(author.token, "POST", {}),
      env
    );
    await createVote((await makeUser()).userId, guide.id);

    const body = await list(author.token);
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications[0]).toMatchObject({ count: 1, read_at: null });
    expect(body.notifications[1].id).toBe(read.id);
  });

  it("ignores downvotes, self-votes, and re-saving an upvote", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const voter = await makeUser();

    await createVote(author.userId, guide.id);
    await createVote(voter.userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });
    expect(await unreadCount(author.token)).toBe(0);

    await admin
      .from("votes")
      .update({ direction: "up", reason: null })
      .eq("voter_id", voter.userId)
      .eq("guide_id", guide.id)
      .throwOnError();
    await admin
      .from("votes")
      .update({ direction: "up", note: "still good" })
      .eq("voter_id", voter.userId)
      .eq("guide_id", guide.id)
      .throwOnError();

    const body = await list(author.token);
    expect(body.notifications.map((n) => n.count)).toEqual([1]);
  });
});

describe("GET /notifications", () => {
  it("401s without a token", async () => {
    const res = await app.request("/notifications", {}, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "GET", "/notifications");
  });

  it("matches the spec and pages newest first", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const guides = [];
    for (let i = 0; i < 3; i++) {
      const { guide } = await createPublishedGuide({ authorId: author.userId });
      await createVote(voter.userId, guide.id);
      guides.push(guide.id);
    }

    const res = await app.request(
      "/notifications?limit=2",
      auth(author.token),
      env
    );
    await expectToMatchSpec(res, "GET", "/notifications");
    const first = (await res.json()) as ListBody;
    const second = await list(author.token, "?limit=2&page=2");

    expect(first.has_more).toBe(true);
    expect(second.has_more).toBe(false);
    expect(
      [...first.notifications, ...second.notifications].map(
        (n) => n.data.guide_id
      )
    ).toEqual([...guides].reverse());
  });

  it("filters by unread and by category", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const { reviewCase, panelist } = await seedCaseForAuthor(
      author.userId,
      "Topology"
    );
    await decide(panelist.token, reviewCase.id, "approved");

    const community = await list(
      author.token,
      "?category=community_engagement"
    );
    expect(community.notifications.map((n) => n.type)).toEqual([
      "guide_upvotes",
    ]);

    await app.request(
      `/notifications/${community.notifications[0].id}/read`,
      jsonAuth(author.token, "POST", {}),
      env
    );
    const unread = await list(author.token, "?filter=unread");
    expect(unread.notifications.map((n) => n.type)).toEqual([
      "guide_review_decision",
    ]);
  });

  it("never shows another user's notifications", async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);

    expect((await list(stranger.token)).notifications).toEqual([]);
    expect(await unreadCount(stranger.token)).toBe(0);
    expect(await unreadCount(author.token)).toBe(1);
  });
});

describe("marking notifications read", () => {
  it("404s on another user's notification and leaves it unread", async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const [target] = (await list(author.token)).notifications;

    const res = await app.request(
      `/notifications/${target.id}/read`,
      jsonAuth(stranger.token, "POST", {}),
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "POST", "/notifications/{id}/read");
    expect(await unreadCount(author.token)).toBe(1);
  });

  it("is idempotent and keeps the first read time", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const [target] = (await list(author.token)).notifications;

    const first = await app.request(
      `/notifications/${target.id}/read`,
      jsonAuth(author.token, "POST", {}),
      env
    );
    await expectToMatchSpec(first, "POST", "/notifications/{id}/read");
    const [afterFirst] = (await list(author.token)).notifications;
    const second = await app.request(
      `/notifications/${target.id}/read`,
      jsonAuth(author.token, "POST", {}),
      env
    );
    const [afterSecond] = (await list(author.token)).notifications;

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(afterFirst.read_at).not.toBeNull();
    expect(afterSecond.read_at).toBe(afterFirst.read_at);
  });

  it("marks all read, or only one category", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const { reviewCase, panelist } = await seedCaseForAuthor(
      author.userId,
      "Topology"
    );
    await decide(panelist.token, reviewCase.id, "approved");

    const scoped = await app.request(
      "/notifications/read-all",
      jsonAuth(author.token, "POST", { category: "guide_statuses" }),
      env
    );
    await expectToMatchSpec(scoped, "POST", "/notifications/read-all");
    const unread = await list(author.token, "?filter=unread");
    expect(unread.notifications.map((n) => n.type)).toEqual(["guide_upvotes"]);

    await app.request(
      "/notifications/read-all",
      jsonAuth(author.token, "POST", {}),
      env
    );
    expect(await unreadCount(author.token)).toBe(0);
  });
});

describe("notification preferences", () => {
  it("lists every type with the defaults from the design", async () => {
    const user = await makeUser();

    const res = await app.request(
      "/notifications/preferences",
      auth(user.token),
      env
    );
    await expectToMatchSpec(res, "GET", "/notifications/preferences");
    const { preferences } = (await res.json()) as {
      preferences: Array<{ type: string; enabled: boolean }>;
    };

    expect(
      Object.fromEntries(preferences.map((p) => [p.type, p.enabled]))
    ).toEqual({
      guide_review_decision: true,
      variant_created: true,
      variant_review_decision: false,
      variant_edited: false,
      guide_upvotes: true,
      guide_downvotes: false,
      review_assignment: false,
      review_deadline: true,
    });
  });

  it("stops a type once the user turns it off, and resumes it", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });

    const off = await app.request(
      "/notifications/preferences/guide_upvotes",
      jsonAuth(author.token, "PUT", { enabled: false }),
      env
    );
    await expectToMatchSpec(off, "PUT", "/notifications/preferences/{type}");
    await createVote((await makeUser()).userId, guide.id);
    expect(await unreadCount(author.token)).toBe(0);

    await app.request(
      "/notifications/preferences/guide_upvotes",
      jsonAuth(author.token, "PUT", { enabled: true }),
      env
    );
    await createVote((await makeUser()).userId, guide.id);
    expect(await unreadCount(author.token)).toBe(1);
  });

  it("400s an unknown type", async () => {
    const user = await makeUser();

    const res = await app.request(
      "/notifications/preferences/carrier_pigeon",
      jsonAuth(user.token, "PUT", { enabled: true }),
      env
    );

    expect(res.status).toBe(400);
  });
});

describe("database guards", () => {
  it("refuses notify() to a signed-in user", async () => {
    const attacker = await makeUser();
    const victim = await makeUser();

    const { error } = await userClient(attacker.token).rpc("notify", {
      p_recipient_id: victim.userId,
      p_type: "guide_upvotes",
      p_data: { title: "phishing" },
    });

    expect(error?.code).toBe("42501");
    expect(await unreadCount(victim.token)).toBe(0);
  });

  it("lets a recipient change read_at and nothing else", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    await createVote((await makeUser()).userId, guide.id);
    const [target] = (await list(author.token)).notifications;
    const client = userClient(author.token);

    const forged = await client
      .from("notifications")
      .update({ data: { title: "forged" } })
      .eq("id", target.id);
    const read = await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", target.id);

    expect(forged.error?.code).toBe("42501");
    expect(read.error).toBeNull();
    const [after] = (await list(author.token)).notifications;
    expect(after.data.title).toBe(target.data.title);
    expect(after.read_at).not.toBeNull();
  });

  it("refuses an unknown type inside notify()", async () => {
    const { userId } = await makeUser();

    const { error } = await admin.rpc("notify", {
      p_recipient_id: userId,
      p_type: "carrier_pigeon",
    });

    expect(error?.message).toContain("Unknown notification type");
  });
});
