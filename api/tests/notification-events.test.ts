import type { CastVoteInput, NotificationsResponse } from "@bluelearn/schemas";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import {
  admin,
  auth,
  env,
  jsonAuth,
  makeUser,
  userClient,
  type Insert,
} from "./helpers";
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

async function vote(token: string, guideId: string, body: CastVoteInput) {
  const res = await app.request(
    `/variants/${guideId}/vote`,
    jsonAuth(token, "PUT", body),
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
  it("routes an approved variant decision to the revision author only", async () => {
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

    await review.decide();

    expect(await notifications(revisionAuthor.token)).toEqual([
      expect.objectContaining({
        type: "variant_review_decision",
        actor: null,
        data: {
          case_id: review.reviewCase.id,
          outcome: "approved",
          title: revision.title,
        },
      }),
    ]);
    expect(await notifications(owner.token)).toEqual([]);
    expect(
      await notifications(canonicalAuthor.token, "guide_review_decision")
    ).toEqual([]);
  });

  it("keeps an approved edit to a published canonical guide on guide_review_decision", async () => {
    const canonicalAuthor = await makeUser();
    const editor = await makeUser();

    await preference(editor.token, "variant_review_decision", true);

    const { guide } = await createPublishedGuide({
      authorId: canonicalAuthor.userId,
    });
    const edit = await createGuideRevision(guide.id, {
      author_id: editor.userId,
      title: "Canonical edit",
    });
    const review = await reviewRevision(edit.id, editor.userId, "guide_edit");

    await review.decide();

    expect(await notifications(editor.token)).toEqual([
      expect.objectContaining({
        type: "guide_review_decision",
        actor: null,
        data: {
          case_id: review.reviewCase.id,
          outcome: "approved",
          title: "Canonical edit",
        },
      }),
    ]);
  });
});

describe("downvote events", () => {
  it("requires opt-in and collects every reason and note on one row, newest first", async () => {
    const author = await makeUser();
    const early = await makeUser();
    const first = await makeUser();
    const second = await makeUser();
    const { base, guide } = await createPublishedGuide({
      authorId: author.userId,
      title: "Voting",
    });
    const guideData = {
      guide_id: guide.id,
      title: "Voting",
      base_slug: base.slug,
      variant_slug: "main",
    };

    await vote(early.token, guide.id, { direction: "down", reason: "unclear" });

    expect(await notifications(author.token)).toEqual([]);

    await preference(author.token, "guide_downvotes", true);
    await vote(first.token, guide.id, {
      direction: "down",
      reason: "missing_step",
      note: "Step 3 skips the setup.",
    });
    await vote(second.token, guide.id, {
      direction: "down",
      reason: "outdated",
    });
    await vote(author.token, guide.id, {
      direction: "down",
      reason: "unclear",
    });

    expect(await notifications(author.token, "guide_downvotes")).toEqual([
      expect.objectContaining({
        count: 2,
        actor: null,
        data: {
          ...guideData,
          feedback: [
            { reason: "outdated", note: null },
            { reason: "missing_step", note: "Step 3 skips the setup." },
          ],
        },
      }),
    ]);
  });

  it("keeps the voter out of every column the author can read", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const other = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const client = userClient(author.token);

    await preference(author.token, "guide_downvotes", true);
    await vote(voter.token, guide.id, {
      direction: "down",
      reason: "broken_link",
      note: "The setup link is dead.",
    });
    await vote(other.token, guide.id, {
      direction: "down",
      reason: "outdated",
    });
    await vote(voter.token, guide.id, { direction: "up" });

    const { data: rows } = await client
      .from("notifications")
      .select("*")
      .throwOnError();
    const down = rows.filter((row) => row.type === "guide_downvotes");
    const up = rows.filter((row) => row.type === "guide_upvotes");

    expect(down).toEqual([
      expect.objectContaining({
        actor_id: null,
        group_key: guide.id,
        group_count: 2,
      }),
    ]);
    expect(JSON.stringify(down)).not.toContain(voter.userId);
    expect(JSON.stringify(down)).not.toContain(other.userId);
    expect(JSON.stringify(up)).toContain(voter.userId);

    const voters = await client.from("notification_voters").select("*");
    const tallies = await client.from("notification_vote_tallies").select("*");

    expect(voters.error?.code).toBe("42501");
    expect(tallies.error?.code).toBe("42501");
  });

  it("counts each downvoter once per guide, even after a flip back", async () => {
    const author = await makeUser();
    const flipper = await makeUser();
    const other = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const another = await createPublishedGuide({ authorId: author.userId });

    await preference(author.token, "guide_downvotes", true);
    await vote(flipper.token, guide.id, {
      direction: "down",
      reason: "unclear",
    });
    await vote(flipper.token, guide.id, { direction: "up" });
    await vote(flipper.token, guide.id, {
      direction: "down",
      reason: "outdated",
    });

    expect(await notifications(author.token, "guide_upvotes")).toEqual([
      expect.objectContaining({
        count: 1,
        actor: expect.objectContaining({ id: flipper.userId }),
      }),
    ]);

    await vote(other.token, guide.id, {
      direction: "down",
      reason: "broken_link",
    });
    await vote(flipper.token, another.guide.id, {
      direction: "down",
      reason: "unclear",
    });

    const rows = await notifications(author.token, "guide_downvotes");
    const onGuide = rows.filter((n) => n.data.guide_id === guide.id);
    const onAnother = rows.filter((n) => n.data.guide_id === another.guide.id);

    expect(onGuide).toEqual([
      expect.objectContaining({
        count: 2,
        data: expect.objectContaining({
          feedback: [
            { reason: "broken_link", note: null },
            { reason: "unclear", note: null },
          ],
        }),
      }),
    ]);
    expect(onAnother).toEqual([expect.objectContaining({ count: 1 })]);
  });

  it("adds a new downvote to the read row, but not an edited one", async () => {
    const author = await makeUser();
    const editor = await makeUser();
    const newcomer = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });

    await preference(author.token, "guide_downvotes", true);
    await vote(editor.token, guide.id, {
      direction: "down",
      reason: "outdated",
    });

    const [row] = await notifications(author.token, "guide_downvotes");

    await read(author.token, row.id);
    await vote(editor.token, guide.id, {
      direction: "down",
      reason: "outdated",
      note: "Still uses the old API.",
    });

    expect(await notifications(author.token, "guide_downvotes")).toEqual([
      expect.objectContaining({
        id: row.id,
        count: 1,
        read_at: expect.any(String),
        data: expect.objectContaining({
          feedback: [{ reason: "outdated", note: null }],
        }),
      }),
    ]);

    await vote(newcomer.token, guide.id, {
      direction: "down",
      reason: "missing_step",
    });

    expect(await notifications(author.token, "guide_downvotes")).toEqual([
      expect.objectContaining({
        id: row.id,
        count: 2,
        read_at: null,
        data: expect.objectContaining({
          feedback: [
            { reason: "missing_step", note: null },
            { reason: "outdated", note: null },
          ],
        }),
      }),
    ]);
  });

  it("keeps one row and every reason when downvotes arrive at once", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const voters = [];
    for (let i = 0; i < 9; i++) {
      voters.push(await makeUser());
    }
    const notes = voters.map((_, i) => `Note ${i}`);
    const [first, ...rest] = voters;
    const castDownvote = (voterId: string, i: number) =>
      createVote(voterId, guide.id, {
        direction: "down",
        reason: "unclear",
        note: notes[i],
      });

    await preference(author.token, "guide_downvotes", true);
    // The first vote creates the tally row. Later votes race on that row,
    // which only its lock serializes.
    await castDownvote(first.userId, 0);
    // Open the connections first, so the votes reach the database together.
    await Promise.all(
      rest.map(() => admin.from("notification_types").select("type"))
    );
    await Promise.all(
      rest.map((voter, i) => castDownvote(voter.userId, i + 1))
    );

    const rows = await notifications(author.token, "guide_downvotes");

    expect(rows).toEqual([
      expect.objectContaining({
        count: voters.length,
        data: expect.objectContaining({
          feedback: expect.arrayContaining(
            notes.map((note) => ({ reason: "unclear", note }))
          ),
        }),
      }),
    ]);
    expect(rows[0].data.feedback).toHaveLength(voters.length);
  });

  it("adds a row with the total and every reason since the previous row after the live tier", async () => {
    const author = await makeUser();
    const { guide } = await createPublishedGuide({ authorId: author.userId });
    const client = userClient(author.token);
    const reasons = [
      "outdated",
      "missing_step",
      "broken_link",
      "prereq_gap",
      "wrong_level",
    ] as const;
    const voters = [];
    for (let i = 0; i <= reasons.length; i++) {
      voters.push(await makeUser());
    }

    await preference(author.token, "guide_downvotes", true);
    await vote(voters[0].token, guide.id, {
      direction: "down",
      reason: "unclear",
    });
    const [live] = await notifications(author.token, "guide_downvotes");

    await admin
      .from("notification_vote_tallies")
      .update({
        started_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      })
      .eq("guide_id", guide.id)
      .eq("type", "guide_downvotes")
      .throwOnError();
    for (const [i, reason] of reasons.entries()) {
      await vote(voters[i + 1].token, guide.id, {
        direction: "down",
        reason,
        note: `Note ${i}`,
      });
    }

    expect(await notifications(author.token, "guide_downvotes")).toEqual([
      expect.objectContaining({
        count: 1,
        actor: null,
        data: expect.objectContaining({
          total: voters.length,
          feedback: reasons
            .map((reason, i) => ({ reason, note: `Note ${i}` }))
            .reverse(),
        }),
      }),
      expect.objectContaining({
        id: live.id,
        count: 1,
        data: expect.objectContaining({
          feedback: [{ reason: "unclear", note: null }],
        }),
      }),
    ]);

    const { data: rows } = await client
      .from("notifications")
      .select("*")
      .throwOnError();

    for (const voter of voters) {
      expect(JSON.stringify(rows)).not.toContain(voter.userId);
    }
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
    { seatStatus: "replaced" as const },
    { closed: true },
    { caseStatus: "approved" as const },
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
    { seatStatus: "replaced" as const },
    { closed: true },
    { caseStatus: "pending" as const },
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

    const client = userClient(member.token);

    const { error } = await client.rpc("notify_review_deadlines");

    expect(error?.code).toBe("42501");
    expect(await notifications(member.token)).toEqual([]);

    await deadlineSweep();
    expect(await notifications(member.token)).toEqual([
      expect.objectContaining({ type: "review_deadline" }),
    ]);
  });
});
