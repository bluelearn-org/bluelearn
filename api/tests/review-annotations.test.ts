import { describe, it, expect } from "vitest";
import type {
  FieldDiff,
  ReviewAnnotationsResponse,
  ReviewCaseStatus,
  ReviewPublication,
  ReviewSuggestion,
  ReviewThread,
  ReviewThreadReply,
} from "@bluelearn/schemas";
import app from "../src/index";
import { admin, auth, env, insert, jsonAuth, makeUser } from "./helpers";
import {
  createGuideReviewCase,
  createPanelMember,
  createReviewCase,
  createReviewPanel,
} from "./factories/reviews";
import {
  createGuide,
  createGuideBase,
  createGuideRevision,
  createPublishedGuide,
} from "./factories/guides";
import { expectToMatchSpec } from "./openapi";

type User = Awaited<ReturnType<typeof makeUser>>;

const DEFINITION = "A group is a set with one operation.";
// "𝔽" is one character but two UTF-16 units, so every offset after this block
// differs between the browser and Postgres.
const FIELD = "Over 𝔽₂ every element is its own inverse.";
const IMAGE = "![Cayley table](https://example.com/cayley.png)";
const BODY = ["# Groups", "", DEFINITION, "", FIELD, "", IMAGE].join("\n");

// What the reader sends for a whole top-level block. Plain paragraphs render
// their source as is; an image renders no text.
function blockAnchor(
  revisionId: string,
  index: number,
  source: string,
  quote = source
) {
  const start = BODY.indexOf(source);
  return {
    revision_id: revisionId,
    kind: "block" as const,
    start_block: index,
    start_offset: 0,
    end_block: index,
    end_offset: quote.length,
    quote,
    source_start: start,
    source_end: start + source.length,
  };
}

function passageAnchor(
  revisionId: string,
  index: number,
  source: string,
  quote: string
) {
  const offset = source.indexOf(quote);
  return {
    ...blockAnchor(revisionId, index, source),
    kind: "passage" as const,
    start_offset: offset,
    end_offset: offset + quote.length,
    quote,
  };
}

// An in-review case on BODY, written by a real author and judged by a panel
// of fresh users on live seats. An edit case starts from a live guide.
async function seedFeedbackCase(
  caseType: "guide_publish" | "guide_edit" = "guide_publish"
) {
  const author = await makeUser();
  let guideId: string;
  let liveRevisionId: string | null = null;
  if (caseType === "guide_edit") {
    const live = await createPublishedGuide({
      title: "Groups",
      body: "A group is a set.",
      authorId: author.userId,
    });
    guideId = live.guide.id;
    liveRevisionId = live.revision.id;
  } else {
    const base = await createGuideBase();
    guideId = (await createGuide(base.id, { author_id: author.userId })).id;
  }

  const revision = await createGuideRevision(guideId, {
    title: "Groups",
    body: BODY,
    author_id: author.userId,
  });
  const reviewCase = await createReviewCase(author.userId, {
    case_type: caseType,
    status: "in_review",
  });
  const panel = await createReviewPanel(reviewCase.id, {
    target_seat_count: 3,
  });
  const panelists: User[] = [];
  for (let i = 0; i < 3; i++) {
    const panelist = await makeUser();
    await createPanelMember(panel.id, panelist.userId);
    panelists.push(panelist);
  }
  await createGuideReviewCase(reviewCase.id, revision.id);
  return {
    author,
    guideId,
    liveRevisionId,
    revision,
    reviewCase,
    panel,
    panelists,
  };
}

function post(token: string, path: string, body: unknown) {
  return app.request(path, jsonAuth(token, "POST", body), env);
}

function getAnnotations(caseId: string, token?: string) {
  return app.request(
    `/reviews/cases/${caseId}/annotations`,
    token ? auth(token) : {},
    env
  );
}

function vote(
  token: string,
  caseId: string,
  decision: "approved" | "rejected"
) {
  return post(
    token,
    `/reviews/cases/${caseId}/decisions`,
    decision === "approved"
      ? { decision }
      : { decision, notes: "Inaccurate.", reasons: ["factual_error"] }
  );
}

// Two of three seats approving is a majority.
async function approveByMajority(panelists: User[], caseId: string) {
  for (const panelist of panelists.slice(0, 2)) {
    const res = await vote(panelist.token, caseId, "approved");
    expect(res.status).toBe(200);
  }
}

function suggest(
  token: string,
  caseId: string,
  revisionId: string,
  proposed: string
) {
  return post(token, `/reviews/cases/${caseId}/suggestions`, {
    anchor: blockAnchor(revisionId, 1, DEFINITION),
    proposed,
    note: "Name the axiom.",
  });
}

async function suggestionOf(res: Response) {
  const body = (await res.json()) as { suggestion: ReviewSuggestion };
  return body.suggestion;
}

function decide(
  token: string,
  caseId: string,
  suggestionId: string,
  decision: "accepted" | "rejected"
) {
  return post(
    token,
    `/reviews/cases/${caseId}/suggestions/${suggestionId}/decision`,
    { decision }
  );
}

async function caseStatus(caseId: string) {
  const { data } = await admin
    .from("review_cases")
    .select("status")
    .eq("id", caseId)
    .single()
    .throwOnError();
  return data.status;
}

async function guideState(guideId: string) {
  const { data } = await admin
    .from("guides")
    .select("status, current_revision_id")
    .eq("id", guideId)
    .single()
    .throwOnError();
  return data;
}

async function revisionBody(revisionId: string) {
  const { data } = await admin
    .from("guide_revisions")
    .select("body, author_id")
    .eq("id", revisionId)
    .single()
    .throwOnError();
  return data;
}

describe("review comment threads", () => {
  it("lets seated panelists comment on passages and the author reply", async () => {
    const { author, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const threadsPath = `/reviews/cases/${reviewCase.id}/threads`;

    const created = await post(panelists[0].token, threadsPath, {
      anchor: passageAnchor(revision.id, 1, DEFINITION, "one operation"),
      body: "Which **operation**?",
    });
    expect(created.status).toBe(201);
    await expectToMatchSpec(created, "POST", "/reviews/cases/{id}/threads");
    const { thread } = (await created.json()) as { thread: ReviewThread };
    expect(thread.anchor.source_text).toBe(DEFINITION);
    expect(thread.anchor_status).toBe("current");
    expect(thread.author).toMatchObject({
      id: panelists[0].userId,
      role: "panelist",
    });

    const second = await post(panelists[1].token, threadsPath, {
      anchor: blockAnchor(revision.id, 1, DEFINITION),
      body: "Say which axioms the operation satisfies.",
    });
    expect(second.status).toBe(201);

    const replied = await post(
      author.token,
      `${threadsPath}/${thread.id}/replies`,
      { body: "Composition of symmetries." }
    );
    expect(replied.status).toBe(201);
    await expectToMatchSpec(
      replied,
      "POST",
      "/reviews/cases/{id}/threads/{threadId}/replies"
    );
    const { reply } = (await replied.json()) as { reply: ReviewThreadReply };
    expect(reply.author).toMatchObject({ id: author.userId, role: "author" });

    const res = await getAnnotations(reviewCase.id, author.token);
    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}/annotations");
    const body = (await res.json()) as ReviewAnnotationsResponse;
    expect(body.viewer_role).toBe("author");
    expect(body.threads.map((t) => t.author?.id)).toEqual([
      panelists[0].userId,
      panelists[1].userId,
    ]);
    expect(body.threads[0].replies.map((r) => r.id)).toEqual([reply.id]);
    expect(body.permissions).toEqual({
      can_comment: false,
      can_reply: true,
      can_suggest: false,
      can_decide_suggestions: true,
    });

    const seated = await getAnnotations(reviewCase.id, panelists[2].token);
    const seatedBody = (await seated.json()) as ReviewAnnotationsResponse;
    expect(seatedBody.permissions).toEqual({
      can_comment: true,
      can_reply: true,
      can_suggest: true,
      can_decide_suggestions: false,
    });
  });

  it("reads source offsets as browser UTF-16 units past astral characters", async () => {
    const { revision, reviewCase, panelists } = await seedFeedbackCase();
    const threadsPath = `/reviews/cases/${reviewCase.id}/threads`;
    const anchor = blockAnchor(revision.id, 3, IMAGE, "");

    const res = await post(panelists[0].token, threadsPath, {
      anchor,
      body: "Label the identity row.",
    });
    expect(res.status).toBe(201);
    const { thread } = (await res.json()) as { thread: ReviewThread };
    expect(thread.anchor.source_text).toBe(IMAGE);
    expect(thread.anchor_status).toBe("current");

    // The same block counted in code points lands one unit early and ends
    // before the closing parenthesis, so it is refused, not re-placed.
    const codePointStart = [...BODY.slice(0, anchor.source_start)].length;
    expect(codePointStart).toBeLessThan(anchor.source_start);
    const shifted = await post(panelists[0].token, threadsPath, {
      anchor: {
        ...anchor,
        source_start: codePointStart,
        source_end: codePointStart + IMAGE.length,
      },
      body: "Label the identity row.",
    });
    expect(shifted.status).toBe(422);
  });

  it("refuses comments from outsiders, expired seats, and the author", async () => {
    const { author, revision, reviewCase, panel } = await seedFeedbackCase();
    const expired = await makeUser();
    await createPanelMember(panel.id, expired.userId, {
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const outsider = await makeUser();

    for (const user of [outsider, expired, author]) {
      const res = await post(
        user.token,
        `/reviews/cases/${reviewCase.id}/threads`,
        {
          anchor: blockAnchor(revision.id, 1, DEFINITION),
          body: "Looks off.",
        }
      );
      expect(res.status).toBe(403);
      await expectToMatchSpec(res, "POST", "/reviews/cases/{id}/threads");
    }

    const { data } = await admin
      .from("review_threads")
      .select("id")
      .eq("case_id", reviewCase.id)
      .throwOnError();
    expect(data).toEqual([]);
  });

  it("refuses anchors on another revision or off the block edges", async () => {
    const { revision, reviewCase, panelists } = await seedFeedbackCase();
    const threadsPath = `/reviews/cases/${reviewCase.id}/threads`;
    const anchor = blockAnchor(revision.id, 1, DEFINITION);
    const send = (overrides: Partial<typeof anchor>) =>
      post(panelists[0].token, threadsPath, {
        anchor: { ...anchor, ...overrides },
        body: "Is this right?",
      });

    const stale = await send({ revision_id: crypto.randomUUID() });
    expect(stale.status).toBe(409);

    const midWord = await send({ source_start: anchor.source_start + 3 });
    expect(midWord.status).toBe(422);
    await expectToMatchSpec(midWord, "POST", "/reviews/cases/{id}/threads");

    const pastEnd = await send({ source_end: BODY.length + 5 });
    expect(pastEnd.status).toBe(422);

    const exact = await send({});
    expect(exact.status).toBe(201);
  });

  it("hides open-case feedback from outsiders and shows it once the case closes", async () => {
    const { revision, reviewCase, panelists } = await seedFeedbackCase();
    const threadsPath = `/reviews/cases/${reviewCase.id}/threads`;
    const anchor = blockAnchor(revision.id, 2, FIELD);
    await post(panelists[0].token, threadsPath, {
      anchor,
      body: "Cite a source.",
    });
    const outsider = await makeUser();

    const hidden = await getAnnotations(reviewCase.id, outsider.token);
    expect(hidden.status).toBe(403);
    await expectToMatchSpec(hidden, "GET", "/reviews/cases/{id}/annotations");

    await vote(panelists[0].token, reviewCase.id, "rejected");
    await vote(panelists[1].token, reviewCase.id, "rejected");

    const shown = await getAnnotations(reviewCase.id);
    expect(shown.status).toBe(200);
    const body = (await shown.json()) as ReviewAnnotationsResponse;
    expect(body.case_status).toBe("rejected");
    expect(body.viewer_role).toBe("public");
    expect(body.threads.map((t) => t.anchor.source_text)).toEqual([FIELD]);
    expect(Object.values(body.permissions)).not.toContain(true);

    const late = await post(panelists[2].token, threadsPath, {
      anchor,
      body: "Too late.",
    });
    expect(late.status).toBe(409);
  });
});

describe("verifier edits", () => {
  it("holds an approved publish until the author accepts, then publishes the edit as a new revision", async () => {
    const { author, guideId, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const proposed = "A group is a set with one associative operation.";

    const created = await suggest(
      panelists[0].token,
      reviewCase.id,
      revision.id,
      proposed
    );
    expect(created.status).toBe(201);
    await expectToMatchSpec(created, "POST", "/reviews/cases/{id}/suggestions");
    const suggestion = await suggestionOf(created);
    expect(suggestion.original).toBe(DEFINITION);
    expect(suggestion.status).toBe("pending");
    expect(suggestion.diff.lines).toEqual([
      { type: "removed", text: DEFINITION },
      { type: "added", text: proposed },
    ]);

    await approveByMajority(panelists, reviewCase.id);

    expect(await caseStatus(reviewCase.id)).toBe("in_review");
    expect((await guideState(guideId)).status).toBe("draft");
    const held = await getAnnotations(reviewCase.id, author.token);
    const heldBody = (await held.json()) as ReviewAnnotationsResponse;
    expect(heldBody.publication).toMatchObject({
      pending_suggestions: 1,
      awaiting_author: true,
      published_revision_id: null,
    });

    const bystander = await decide(
      panelists[2].token,
      reviewCase.id,
      suggestion.id,
      "accepted"
    );
    expect(bystander.status).toBe(403);
    expect(await caseStatus(reviewCase.id)).toBe("in_review");

    const accepted = await decide(
      author.token,
      reviewCase.id,
      suggestion.id,
      "accepted"
    );
    expect(accepted.status).toBe(200);
    await expectToMatchSpec(
      accepted,
      "POST",
      "/reviews/cases/{id}/suggestions/{suggestionId}/decision"
    );
    const result = (await accepted.json()) as {
      suggestion: ReviewSuggestion;
      case_status: ReviewCaseStatus;
      publication: ReviewPublication;
    };
    expect(result.case_status).toBe("approved");

    const guide = await guideState(guideId);
    const liveId = guide.current_revision_id;
    expect(guide.status).toBe("published");
    expect(liveId).not.toBe(revision.id);
    expect(result.suggestion.applied_revision_id).toBe(liveId);
    expect(result.publication.published_revision_id).toBe(liveId);

    const published = await revisionBody(liveId!);
    expect(published.body).toBe(BODY.replace(DEFINITION, proposed));
    expect(published.author_id).toBe(author.userId);
    expect((await revisionBody(revision.id)).body).toBe(BODY);

    const diff = await app.request(
      `/guide-revisions/${revision.id}/diff/${liveId}`,
      {},
      env
    );
    expect(diff.status).toBe(200);
    const { fields } = (await diff.json()) as { fields: { body: FieldDiff } };
    expect(fields.body.lines?.filter((l) => l.type !== "unchanged")).toEqual([
      { type: "removed", text: DEFINITION },
      { type: "added", text: proposed },
    ]);
  });

  it("publishes the reviewed revision unchanged when the author rejects the edit", async () => {
    const { author, guideId, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const suggestion = await suggestionOf(
      await suggest(
        panelists[0].token,
        reviewCase.id,
        revision.id,
        "A group is a monoid with inverses."
      )
    );
    await approveByMajority(panelists, reviewCase.id);

    const rejected = await decide(
      author.token,
      reviewCase.id,
      suggestion.id,
      "rejected"
    );
    expect(rejected.status).toBe(200);
    const result = (await rejected.json()) as {
      suggestion: ReviewSuggestion;
      case_status: ReviewCaseStatus;
    };
    expect(result.case_status).toBe("approved");
    expect(result.suggestion.status).toBe("rejected");
    expect(result.suggestion.applied_revision_id).toBeNull();

    const guide = await guideState(guideId);
    expect(guide.status).toBe("published");
    expect(guide.current_revision_id).toBe(revision.id);
  });

  it("keeps an edited guide's live revision until the author answers", async () => {
    const { author, guideId, liveRevisionId, revision, reviewCase, panelists } =
      await seedFeedbackCase("guide_edit");
    const suggestion = await suggestionOf(
      await suggest(
        panelists[0].token,
        reviewCase.id,
        revision.id,
        "A group is a set with one associative operation."
      )
    );
    await approveByMajority(panelists, reviewCase.id);

    expect((await guideState(guideId)).current_revision_id).toBe(
      liveRevisionId
    );

    const accepted = await decide(
      author.token,
      reviewCase.id,
      suggestion.id,
      "accepted"
    );
    expect(accepted.status).toBe(200);

    const { current_revision_id } = await guideState(guideId);
    expect([liveRevisionId, revision.id]).not.toContain(current_revision_id);

    // History reads live -> reviewed -> accepted edits.
    const prev = await app.request(
      `/guide-revisions/${current_revision_id}/diff/prev`,
      {},
      env
    );
    expect(prev.status).toBe(200);
    const { from } = (await prev.json()) as { from: { id: string } };
    expect(from.id).toBe(revision.id);
  });

  it("refuses to accept an edit that overlaps an accepted one", async () => {
    const { author, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const first = await suggestionOf(
      await suggest(
        panelists[0].token,
        reviewCase.id,
        revision.id,
        "A group is a set with an associative operation."
      )
    );
    const second = await suggestionOf(
      await suggest(
        panelists[1].token,
        reviewCase.id,
        revision.id,
        "A group is a monoid with inverses."
      )
    );

    const accepted = await decide(
      author.token,
      reviewCase.id,
      first.id,
      "accepted"
    );
    expect(accepted.status).toBe(200);

    const clash = await decide(
      author.token,
      reviewCase.id,
      second.id,
      "accepted"
    );
    expect(clash.status).toBe(409);
    await expectToMatchSpec(
      clash,
      "POST",
      "/reviews/cases/{id}/suggestions/{suggestionId}/decision"
    );

    const changedMind = await decide(
      author.token,
      reviewCase.id,
      first.id,
      "rejected"
    );
    expect(changedMind.status).toBe(409);

    const declined = await decide(
      author.token,
      reviewCase.id,
      second.id,
      "rejected"
    );
    expect(declined.status).toBe(200);
  });

  it("splices two accepted edits, one past an astral character, into the published body", async () => {
    const { author, guideId, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const definition =
      "A group is a set with an associative operation, an identity, and inverses.";
    const image = "![Cayley table of Z/2](https://example.com/z2.png)";

    // Created and accepted front to back with growing text, so splicing in
    // that order would shift the back edit. Its offsets also sit past "𝔽".
    const front = await suggest(
      panelists[0].token,
      reviewCase.id,
      revision.id,
      definition
    );
    expect(front.status).toBe(201);
    const back = await post(
      panelists[1].token,
      `/reviews/cases/${reviewCase.id}/suggestions`,
      {
        anchor: blockAnchor(revision.id, 3, IMAGE, ""),
        proposed: image,
      }
    );
    expect(back.status).toBe(201);
    await approveByMajority(panelists, reviewCase.id);

    for (const created of [front, back]) {
      const suggestion = await suggestionOf(created);
      const accepted = await decide(
        author.token,
        reviewCase.id,
        suggestion.id,
        "accepted"
      );
      expect(accepted.status).toBe(200);
    }
    expect(await caseStatus(reviewCase.id)).toBe("approved");

    const { current_revision_id } = await guideState(guideId);
    const published = await revisionBody(current_revision_id!);
    expect(published.body).toBe(
      ["# Groups", "", definition, "", FIELD, "", image].join("\n")
    );
  });

  it("closes a rejected case despite a pending edit, which can then not be answered", async () => {
    const { author, guideId, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const suggestion = await suggestionOf(
      await suggest(
        panelists[0].token,
        reviewCase.id,
        revision.id,
        "A group is a monoid with inverses."
      )
    );

    await vote(panelists[0].token, reviewCase.id, "rejected");
    await vote(panelists[1].token, reviewCase.id, "rejected");
    expect(await caseStatus(reviewCase.id)).toBe("rejected");

    const late = await decide(
      author.token,
      reviewCase.id,
      suggestion.id,
      "accepted"
    );
    expect(late.status).toBe(409);
    expect((await guideState(guideId)).status).toBe("draft");

    const closed = await getAnnotations(reviewCase.id, author.token);
    const closedBody = (await closed.json()) as ReviewAnnotationsResponse;
    expect(closedBody.suggestions[0].status).toBe("pending");
    expect(closedBody.permissions.can_decide_suggestions).toBe(false);
    expect(closedBody.publication.awaiting_author).toBe(false);
  });

  it("adds media named only in an accepted edit to the published asset manifest", async () => {
    const { author, guideId, revision, reviewCase, panelists } =
      await seedFeedbackCase();
    const asset = await insert("media_assets", {
      storage_key: `uploads/${crypto.randomUUID()}_ring.png`,
    });
    const suggestion = await suggestionOf(
      await suggest(
        panelists[0].token,
        reviewCase.id,
        revision.id,
        `![Ring](https://cdn.example/media/${asset.storage_key})`
      )
    );
    await approveByMajority(panelists, reviewCase.id);
    await decide(author.token, reviewCase.id, suggestion.id, "accepted");

    const manifest = async (revisionId: string) => {
      const { data } = await admin
        .from("revision_assets")
        .select("asset_id")
        .eq("revision_id", revisionId)
        .throwOnError();
      return data.map((row) => row.asset_id);
    };
    const { current_revision_id } = await guideState(guideId);
    expect(await manifest(current_revision_id!)).toContain(asset.id);
    expect(await manifest(revision.id)).not.toContain(asset.id);
  });

  it("refuses edits from the author, no-op edits, and partial-block edits", async () => {
    const { author, revision, reviewCase, panelists } =
      await seedFeedbackCase();

    const byAuthor = await suggest(
      author.token,
      reviewCase.id,
      revision.id,
      "A group is a monoid with inverses."
    );
    expect(byAuthor.status).toBe(403);

    const unchanged = await suggest(
      panelists[0].token,
      reviewCase.id,
      revision.id,
      DEFINITION
    );
    expect(unchanged.status).toBe(422);

    const partial = await post(
      panelists[0].token,
      `/reviews/cases/${reviewCase.id}/suggestions`,
      {
        anchor: passageAnchor(revision.id, 1, DEFINITION, "one operation"),
        proposed: "two operations",
      }
    );
    expect(partial.status).toBe(400);

    const { data } = await admin
      .from("review_suggestions")
      .select("id")
      .eq("case_id", reviewCase.id)
      .throwOnError();
    expect(data).toEqual([]);
  });
});
