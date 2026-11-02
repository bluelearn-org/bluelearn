import { createClient } from "@supabase/supabase-js";
import type { NotificationsResponse } from "@bluelearn/schemas";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import type { Database } from "../src/database.types";
import { admin, auth, env, jsonAuth, makeUser, type Insert } from "./helpers";
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

async function notifications(token: string, type?: string) {
  const res = await app.request("/notifications", auth(token), env);

  expect(res.status).toBe(200);

  const body = (await res.json()) as NotificationsResponse;

  return body.notifications.filter((row) => !type || row.type === type);
}

async function preference(token: string, type: string, enabled: boolean) {
  const res = await app.request(
    `/notifications/preferences/${type}`,
    jsonAuth(token, "PUT", { enabled }),
    env
  );

  expect(res.status).toBe(200);
}

async function read(token: string, id: string) {
  const res = await app.request(
    `/notifications/${id}/read`,
    jsonAuth(token, "POST", {}),
    env
  );

  expect(res.status).toBe(200);
}

async function reviewRevision(
  revisionId: string,
  authorId: string,
  caseType: Insert<"review_cases">["case_type"] = "guide_publish"
) {
  const panelist = await makeUser();
  const reviewCase = await createReviewCase(authorId, {
    case_type: caseType,
    status: "in_review",
  });
  await createGuideReviewCase(reviewCase.id, revisionId);
  const panel = await createReviewPanel(reviewCase.id);
  await createPanelMember(panel.id, panelist.userId);

  return {
    reviewCase,
    async decide(outcome: "approved" | "rejected" = "approved") {
      const res = await app.request(
        `/reviews/cases/${reviewCase.id}/decisions`,
        jsonAuth(
          panelist.token,
          "POST",
          outcome === "approved"
            ? { decision: outcome }
            : {
                decision: outcome,
                notes: "Missing required steps.",
                reasons: ["clarity_issue"],
              }
        ),
        env
      );

      expect(res.status).toBe(200);

      const { data } = await admin
        .from("review_cases")
        .select("status")
        .eq("id", reviewCase.id)
        .single()
        .throwOnError();

      expect(data?.status).toBe(outcome);
    },
  };
}

async function deadlineSweep() {
  await admin.rpc("notify_review_deadlines").throwOnError();
}

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

async function reviewSeat(
  memberId: string,
  options: {
    caseStatus?: Insert<"review_cases">["status"];
    seatStatus?: Insert<"panel_members">["status"];
    expiresAt?: string | null;
    closed?: boolean;
    linked?: boolean;
  } = {}
) {
  const author = await makeUser();
  const reviewCase = await createReviewCase(author.userId, {
    status: options.caseStatus ?? "in_review",
  });
  const title = `Review ${crypto.randomUUID()}`;

  if (options.linked !== false) {
    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: author.userId });
    const revision = await createGuideRevision(guide.id, {
      author_id: author.userId,
      title,
    });
    await createGuideReviewCase(reviewCase.id, revision.id);
  }

  const panel = await createReviewPanel(reviewCase.id, {
    ...(options.closed
      ? { closed_at: new Date().toISOString(), outcome: "approved" as const }
      : {}),
  });
  const seat = await createPanelMember(panel.id, memberId, {
    status: options.seatStatus ?? "assigned",
    expires_at: options.expiresAt ?? hoursFromNow(24),
  });

  // The insert trigger supplies an expiry for null; a later cleared expiry is
  // the real nullable state the sweep must also exclude.
  if (options.expiresAt === null) {
    await admin
      .from("panel_members")
      .update({ expires_at: null })
      .eq("id", seat.id)
      .throwOnError();
  }

  return { reviewCase, panel, seat, title };
}

describe("variant publication notifications", () => {
  it("waits for first publication and uses its revision author, not the guide owner", async () => {
    const canonicalAuthor = await makeUser();
    const owner = await makeUser();
    const revisionAuthor = await makeUser();
    const { base } = await createPublishedGuide({
      authorId: canonicalAuthor.userId,
    });
    const variant = await createGuide(base.id, {
      author_id: owner.userId,
      slug: "alternative",
    });
    const draft = await createGuideRevision(variant.id, {
      author_id: revisionAuthor.userId,
      title: "Alternative proof",
      status: "draft",
    });

    await admin
      .from("guide_revisions")
      .update({ body: "Autosaved draft" })
      .eq("id", draft.id)
      .throwOnError();

    expect(await notifications(canonicalAuthor.token)).toEqual([]);

    await admin
      .from("guide_revisions")
      .update({ status: "submitted" })
      .eq("id", draft.id)
      .throwOnError();
    const review = await reviewRevision(draft.id, revisionAuthor.userId);

    expect(await notifications(canonicalAuthor.token)).toEqual([]);

    await review.decide();

    expect(await notifications(canonicalAuthor.token)).toEqual([
      expect.objectContaining({
        type: "variant_created",
        actor: expect.objectContaining({ id: revisionAuthor.userId }),
        count: 1,
        data: {
          guide_id: variant.id,
          title: "Alternative proof",
          base_slug: base.slug,
          variant_slug: "alternative",
        },
      }),
    ]);
    expect(await notifications(owner.token)).toEqual([]);
  });

  it("notifies the original variant author only for another author's published edit", async () => {
    const canonicalAuthor = await makeUser();
    const owner = await makeUser();
    const editor = await makeUser();

    await preference(owner.token, "variant_edited", true);

    const { base } = await createPublishedGuide({
      authorId: canonicalAuthor.userId,
    });
    const variant = await createGuide(base.id, {
      author_id: owner.userId,
      slug: "variant",
    });
    const first = await createGuideRevision(variant.id, {
      author_id: owner.userId,
    });
    const initialReview = await reviewRevision(first.id, owner.userId);

    await initialReview.decide();

    expect(await notifications(owner.token, "variant_edited")).toEqual([]);

    const edit = await createGuideRevision(variant.id, {
      author_id: editor.userId,
      title: "Revised variant",
    });

    await admin
      .from("guide_revisions")
      .update({ body: "Not yet published" })
      .eq("id", edit.id)
      .throwOnError();

    expect(await notifications(owner.token, "variant_edited")).toEqual([]);

    const editReview = await reviewRevision(
      edit.id,
      editor.userId,
      "guide_edit"
    );

    await editReview.decide();

    const [notice] = await notifications(owner.token, "variant_edited");

    expect(notice).toMatchObject({
      actor: { id: editor.userId },
      count: 1,
      data: {
        guide_id: variant.id,
        title: "Revised variant",
        base_slug: base.slug,
        variant_slug: "variant",
      },
    });

    const ownEdit = await createGuideRevision(variant.id, {
      author_id: owner.userId,
    });
    const ownReview = await reviewRevision(
      ownEdit.id,
      owner.userId,
      "guide_edit"
    );

    await ownReview.decide();

    expect(
      (await notifications(owner.token, "variant_edited")).map((n) => n.id)
    ).toEqual([notice.id]);
    expect(
      await notifications(canonicalAuthor.token, "variant_created")
    ).toHaveLength(1);
    expect(await notifications(editor.token, "variant_edited")).toEqual([]);
  });

  it("suppresses first-publication notices when the revision author owns the canonical guide", async () => {
    const author = await makeUser();
    const { base } = await createPublishedGuide({ authorId: author.userId });
    const variant = await createGuide(base.id, { author_id: author.userId });
    const revision = await createGuideRevision(variant.id, {
      author_id: author.userId,
    });
    const review = await reviewRevision(revision.id, author.userId);

    await review.decide();

    expect(await notifications(author.token, "variant_created")).toEqual([]);
  });
});

describe("review decision type separation", () => {
  it.each(["approved", "rejected"] as const)(
    "routes %s variant decisions to the revision author only",
    async (outcome) => {
      const canonicalAuthor = await makeUser();
      const owner = await makeUser();
      const revisionAuthor = await makeUser();

      await preference(revisionAuthor.token, "variant_review_decision", true);

      const { base } = await createPublishedGuide({
        authorId: canonicalAuthor.userId,
      });
      const variant = await createGuide(base.id, { author_id: owner.userId });
      const revision = await createGuideRevision(variant.id, {
        author_id: revisionAuthor.userId,
        title: "Variant decision",
      });
      const review = await reviewRevision(revision.id, revisionAuthor.userId);

      await review.decide(outcome);

      expect(await notifications(revisionAuthor.token)).toEqual([
        expect.objectContaining({
          type: "variant_review_decision",
          actor: null,
          data: {
            case_id: review.reviewCase.id,
            outcome,
            title: revision.title,
          },
        }),
      ]);
      expect(await notifications(owner.token)).toEqual([]);
      expect(
        await notifications(canonicalAuthor.token, "guide_review_decision")
      ).toEqual([]);
    }
  );

  it("keeps a first canonical submission on guide_review_decision even with no canonical pointer", async () => {
    const author = await makeUser();
    const base = await createGuideBase();
    const guide = await createGuide(base.id, { author_id: author.userId });
    const revision = await createGuideRevision(guide.id, {
      author_id: author.userId,
    });
    const review = await reviewRevision(revision.id, author.userId);

    await review.decide();

    expect(await notifications(author.token)).toEqual([
      expect.objectContaining({
        type: "guide_review_decision",
        actor: null,
        data: {
          case_id: review.reviewCase.id,
          outcome: "approved",
          title: revision.title,
        },
      }),
    ]);
  });
});

describe("downvote events", () => {
  it("requires opt-in, groups by guide independently of upvotes, ignores unchanged votes, and reopens after read", async () => {
    const author = await makeUser();
    const first = await makeUser();
    const second = await makeUser();
    const { base, guide } = await createPublishedGuide({
      authorId: author.userId,
      title: "Voting",
    });

    await createVote(first.userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });

    expect(await notifications(author.token)).toEqual([]);

    await preference(author.token, "guide_downvotes", true);
    await createVote(second.userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });
    await admin
      .from("votes")
      .update({ direction: "down", reason: "unclear" })
      .eq("voter_id", second.userId)
      .eq("guide_id", guide.id)
      .throwOnError();
    await createVote(author.userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });

    const [down] = await notifications(author.token);

    expect(down).toMatchObject({
      type: "guide_downvotes",
      count: 1,
      actor: { id: second.userId },
      data: {
        guide_id: guide.id,
        title: "Voting",
        base_slug: base.slug,
        variant_slug: "main",
      },
    });

    await admin
      .from("votes")
      .update({ direction: "up", reason: null })
      .eq("voter_id", first.userId)
      .eq("guide_id", guide.id)
      .throwOnError();
    await admin
      .from("votes")
      .update({ direction: "down", reason: "unclear" })
      .eq("voter_id", first.userId)
      .eq("guide_id", guide.id)
      .throwOnError();

    expect(await notifications(author.token, "guide_downvotes")).toEqual([
      expect.objectContaining({
        id: down.id,
        count: 2,
        actor: expect.objectContaining({ id: first.userId }),
      }),
    ]);
    expect(await notifications(author.token, "guide_upvotes")).toEqual([
      expect.objectContaining({ count: 1 }),
    ]);

    const another = await createPublishedGuide({ authorId: author.userId });
    await createVote(first.userId, another.guide.id, {
      direction: "down",
      reason: "unclear",
    });
    await read(author.token, down.id);
    await createVote((await makeUser()).userId, guide.id, {
      direction: "down",
      reason: "unclear",
    });
    const rows = await notifications(author.token, "guide_downvotes");

    expect(rows).toHaveLength(3);
    expect(rows.find((n) => n.id === down.id)).toMatchObject({
      count: 2,
      read_at: expect.any(String),
    });
    expect(rows.filter((n) => n.read_at === null)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          count: 1,
          data: expect.objectContaining({ guide_id: guide.id }),
        }),
        expect.objectContaining({
          count: 1,
          data: expect.objectContaining({ guide_id: another.guide.id }),
        }),
      ])
    );
  });
});

describe("review assignments", () => {
  it("notifies an updated assignee once and gives them their own reminder at the same expiry", async () => {
    const previous = await makeUser();
    const replacement = await makeUser();

    await preference(previous.token, "review_assignment", true);
    await preference(replacement.token, "review_assignment", true);

    const initial = await reviewSeat(previous.userId);

    await deadlineSweep();

    const [previousReminder] = await notifications(
      previous.token,
      "review_deadline"
    );

    expect(previousReminder).toMatchObject({
      data: { seat_id: initial.seat.id, expires_at: initial.seat.expires_at },
    });

    await read(previous.token, previousReminder.id);

    await admin
      .from("panel_members")
      .update({
        member_id: replacement.userId,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        expires_at: initial.seat.expires_at,
      })
      .eq("id", initial.seat.id)
      .throwOnError();

    const expectedData = {
      case_id: initial.reviewCase.id,
      seat_id: initial.seat.id,
      title: initial.title,
      expires_at: initial.seat.expires_at,
    };
    const [assignment] = await notifications(
      replacement.token,
      "review_assignment"
    );

    expect(assignment).toMatchObject({
      actor: null,
      count: 1,
      data: expectedData,
    });

    await read(replacement.token, assignment.id);

    await admin
      .from("panel_members")
      .update({ member_id: replacement.userId, status: "assigned" })
      .eq("id", initial.seat.id)
      .throwOnError();
    await Promise.all([deadlineSweep(), deadlineSweep()]);

    expect(await notifications(replacement.token, "review_assignment")).toEqual(
      [
        expect.objectContaining({
          id: assignment.id,
          count: 1,
          read_at: expect.any(String),
        }),
      ]
    );
    expect(await notifications(replacement.token, "review_deadline")).toEqual([
      expect.objectContaining({ actor: null, count: 1, data: expectedData }),
    ]);
    expect(
      await notifications(previous.token, "review_assignment")
    ).toHaveLength(1);
    expect(await notifications(previous.token, "review_deadline")).toEqual([
      expect.objectContaining({
        id: previousReminder.id,
        count: 1,
        read_at: expect.any(String),
      }),
    ]);
  });

  it("is opt-in at assignment time and includes newly inserted replacement seats", async () => {
    const member = await makeUser();
    const initial = await reviewSeat(member.userId);

    expect(await notifications(member.token)).toEqual([]);

    await preference(member.token, "review_assignment", true);

    expect(await notifications(member.token)).toEqual([]);

    await admin
      .from("panel_members")
      .update({ status: "replaced" })
      .eq("id", initial.seat.id)
      .throwOnError();

    const replacementMember = await makeUser();
    await preference(replacementMember.token, "review_assignment", true);
    const replacement = await createPanelMember(
      initial.panel.id,
      replacementMember.userId
    );

    expect(await notifications(replacementMember.token)).toEqual([
      expect.objectContaining({
        type: "review_assignment",
        actor: null,
        data: {
          case_id: initial.reviewCase.id,
          seat_id: replacement.id,
          title: initial.title,
          expires_at: replacement.expires_at,
        },
      }),
    ]);

    const pending = await reviewSeat(member.userId, {
      caseStatus: "pending",
      linked: false,
    });

    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({
        type: "review_assignment",
        actor: null,
        data: {
          case_id: pending.reviewCase.id,
          seat_id: pending.seat.id,
          title: null,
          expires_at: pending.seat.expires_at,
        },
      }),
    ]);
  });

  it.each([
    { seatStatus: "completed" as const },
    { seatStatus: "replaced" as const },
    { seatStatus: "recused" as const },
    { closed: true },
    { caseStatus: "approved" as const },
    { caseStatus: "rejected" as const },
  ])("excludes ineligible assignment %j", async (options) => {
    const member = await makeUser();
    await preference(member.token, "review_assignment", true);

    await reviewSeat(member.userId, options);

    expect(await notifications(member.token)).toEqual([]);
  });
});

describe("review deadline sweeps", () => {
  it("skips a deleted reviewer without blocking another reviewer's reminder", async () => {
    const departed = await makeUser();
    const member = await makeUser();
    const abandoned = await reviewSeat(departed.userId);
    const active = await reviewSeat(member.userId);

    await admin
      .from("profiles")
      .delete()
      .eq("id", departed.userId)
      .throwOnError();

    const { error } = await admin.auth.admin.deleteUser(departed.userId);

    expect(error).toBeNull();

    const { data: seat } = await admin
      .from("panel_members")
      .select("member_id")
      .eq("id", abandoned.seat.id)
      .single()
      .throwOnError();

    expect(seat?.member_id).toBeNull();

    await deadlineSweep();

    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({
        type: "review_deadline",
        data: expect.objectContaining({ seat_id: active.seat.id }),
      }),
    ]);
  });

  it("delivers through the five-minute cron once per seat and expiry, even after read", async () => {
    const member = await makeUser();
    const near = await reviewSeat(member.userId);

    await app.scheduled({ cron: "*/5 * * * *" } as ScheduledController, env);

    const [notice] = await notifications(member.token);

    expect(notice).toMatchObject({
      type: "review_deadline",
      actor: null,
      count: 1,
      data: {
        case_id: near.reviewCase.id,
        seat_id: near.seat.id,
        title: near.title,
        expires_at: near.seat.expires_at,
      },
    });
    expect(await notifications(member.token)).toHaveLength(1);

    await read(member.token, notice.id);
    await app.scheduled({ cron: "*/5 * * * *" } as ScheduledController, env);

    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({
        id: notice.id,
        count: 1,
        read_at: expect.any(String),
      }),
    ]);

    const changedExpiry = hoursFromNow(36);
    const { data: changedSeat } = await admin
      .from("panel_members")
      .update({ expires_at: changedExpiry })
      .eq("id", near.seat.id)
      .select("expires_at")
      .single()
      .throwOnError();

    await deadlineSweep();
    await deadlineSweep();

    const rows = await notifications(member.token);

    expect(rows).toHaveLength(2);
    expect(rows.find((n) => n.read_at === null)).toMatchObject({
      type: "review_deadline",
      count: 1,
      data: {
        case_id: near.reviewCase.id,
        seat_id: near.seat.id,
        expires_at: changedSeat?.expires_at,
      },
    });
  });

  it("keeps separate seats with the same expiry and supports cases without a linked title", async () => {
    const member = await makeUser();
    const expiry = hoursFromNow(24);
    const first = await reviewSeat(member.userId, { expiresAt: expiry });
    const second = await reviewSeat(member.userId, {
      expiresAt: expiry,
      linked: false,
    });

    await deadlineSweep();
    await deadlineSweep();

    const rows = await notifications(member.token);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "review_deadline",
          actor: null,
          count: 1,
          data: {
            case_id: first.reviewCase.id,
            seat_id: first.seat.id,
            title: first.title,
            expires_at: first.seat.expires_at,
          },
        }),
        expect.objectContaining({
          type: "review_deadline",
          actor: null,
          count: 1,
          data: {
            case_id: second.reviewCase.id,
            seat_id: second.seat.id,
            title: null,
            expires_at: second.seat.expires_at,
          },
        }),
      ])
    );
  });

  it.each([
    { expiresAt: hoursFromNow(72) },
    { expiresAt: hoursFromNow(-1) },
    { expiresAt: null },
    { seatStatus: "completed" as const },
    { seatStatus: "replaced" as const },
    { seatStatus: "recused" as const },
    { closed: true },
    { caseStatus: "pending" as const },
    { caseStatus: "approved" as const },
    { caseStatus: "rejected" as const },
  ])("excludes an ineligible deadline %j", async (options) => {
    const member = await makeUser();
    await reviewSeat(member.userId, options);
    await deadlineSweep();

    expect(await notifications(member.token)).toEqual([]);
  });

  it("consumes an eligible reminder while opted out instead of replaying on opt-in", async () => {
    const member = await makeUser();
    await preference(member.token, "review_deadline", false);

    const near = await reviewSeat(member.userId);

    await deadlineSweep();

    expect(await notifications(member.token)).toEqual([]);

    await preference(member.token, "review_deadline", true);
    await deadlineSweep();

    expect(await notifications(member.token)).toEqual([]);

    await admin
      .from("panel_members")
      .update({ expires_at: hoursFromNow(36) })
      .eq("id", near.seat.id)
      .throwOnError();

    await deadlineSweep();

    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({
        type: "review_deadline",
        data: expect.objectContaining({ seat_id: near.seat.id }),
      }),
    ]);
  });

  it("denies the sweep RPC to a normal signed-in client without consuming the reminder", async () => {
    const member = await makeUser();
    await reviewSeat(member.userId);

    const client = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${member.token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { error } = await client.rpc("notify_review_deadlines");

    expect(error?.code).toBe("42501");
    expect(await notifications(member.token)).toEqual([]);

    await deadlineSweep();
    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({ type: "review_deadline" }),
    ]);
  });
});
